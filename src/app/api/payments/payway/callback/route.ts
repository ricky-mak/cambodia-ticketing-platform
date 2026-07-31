import { NextResponse } from "next/server";
import { processCallback } from "@/services/payment.service";
import { logger } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PayWay server-to-server pushback. The body is unsigned and omits the amount,
 * so processCallback re-verifies via the signed check-transaction API before
 * confirming anything. We always return 2xx on handled input so PayWay does not
 * retry unnecessarily; genuine processing errors return 500 (retryable).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // PayWay may post form-encoded in some setups; try that as a fallback.
    try {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } catch {
      return NextResponse.json({ ok: false, error: "Unreadable body" }, { status: 400 });
    }
  }

  try {
    const result = await processCallback(body);
    return NextResponse.json({ ok: true, note: result.note });
  } catch (error) {
    logger.error("PayWay callback processing failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
