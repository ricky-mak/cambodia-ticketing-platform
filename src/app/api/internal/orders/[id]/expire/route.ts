import { NextResponse } from "next/server";
import { assertInternalRequest } from "@/lib/internal-auth";
import { expireOrder } from "@/services/order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!assertInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await expireOrder(id);
  // Always 2xx when the work succeeded or was already done (Cloud Tasks
  // treats non-2xx as retryable).
  return NextResponse.json({ ok: true, ...result });
}
