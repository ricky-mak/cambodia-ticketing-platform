import { NextResponse } from "next/server";
import { getOrderByPublicToken } from "@/services/order.service";
import { reconcilePayment } from "@/services/payment.service";
import { getPaymentProvider } from "@/services/payments";
import { OrderStatus } from "@/types/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, token-scoped status refresh used by the order page poller. For a
 * PENDING order it asks the gateway (signed check-transaction) whether payment
 * has completed and confirms if so. Safe to expose: the token is unguessable
 * and this can only confirm a genuinely gateway-approved payment.
 *
 * Skipped for the fake provider (which always "approves") so cancelled dev
 * orders correctly stay pending and expire.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const view = await getOrderByPublicToken(token);
  if (!view) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let status = view.order.status;
  if (
    status === OrderStatus.PENDING &&
    getPaymentProvider().name !== "fake"
  ) {
    await reconcilePayment(view.order.orderNumber);
    const refreshed = await getOrderByPublicToken(token);
    status = refreshed?.order.status ?? status;
  }

  return NextResponse.json({ status });
}
