import { NextResponse } from "next/server";
import { z } from "zod";
import { assertInternalRequest } from "@/lib/internal-auth";
import { reconcilePayment } from "@/services/payment.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ merchantTransactionId: z.string().min(1) });

/**
 * Reconcile a payment whose callback may have been lost. Queries the provider
 * for the authoritative status and confirms if approved. Protected as an
 * internal endpoint.
 */
export async function POST(request: Request) {
  if (!assertInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const result = await reconcilePayment(parsed.data.merchantTransactionId);
  return NextResponse.json({ ok: true, ...result });
}
