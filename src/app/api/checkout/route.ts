import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, clientIp } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createReservation, ReservationError } from "@/services/order.service";
import { initiateCheckout } from "@/services/payment.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  zoneId: z.string().uuid(),
  quantity: z.number().int().positive().max(50),
  customerName: z.string().trim().min(1).max(255),
  customerEmail: z.string().trim().email().max(320),
  customerPhone: z.string().trim().min(3).max(64),
  agreeTerms: z.literal(true),
});

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "checkout", 15, 60_000);
  if (limited) return limited;

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form and try again." },
      { status: 400 },
    );
  }

  try {
    const result = await createReservation({
      zoneId: parsed.data.zoneId,
      quantity: parsed.data.quantity,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      ipAddress: clientIp(request),
    });

    const base = process.env.APPLICATION_BASE_URL ?? new URL(request.url).origin;
    const instruction = await initiateCheckout({
      orderId: result.orderId,
      merchantTransactionId: result.orderNumber,
      amountMinor: result.totalMinor,
      currency: result.currency,
      itemName: result.itemName,
      customer: {
        name: parsed.data.customerName,
        email: parsed.data.customerEmail,
        phone: parsed.data.customerPhone,
      },
      returnUrl: `${base}/api/payments/payway/callback`,
      continueSuccessUrl: `${base}/order/${result.publicToken}`,
      cancelUrl: `${base}/order/${result.publicToken}`,
    });

    return NextResponse.json({
      ok: true,
      publicToken: result.publicToken,
      orderNumber: result.orderNumber,
      checkout: instruction,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      // 429 for the abuse cap; 409 for availability/sales issues.
      const status = error.code === "TOO_MANY_PENDING" ? 429 : 409;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }
    return NextResponse.json(
      { error: "Something went wrong creating your order." },
      { status: 500 },
    );
  }
}
