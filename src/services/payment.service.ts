import { getDataSource, getRepo } from "@/lib/database";
import { Payment } from "@/entities/payment.entity";
import { PaymentStatus, OrderStatus } from "@/types/enums";
import {
  getPaymentProvider,
  type CheckoutInstruction,
} from "./payments";
import { createTicketsForPaidOrder } from "./ticket.service";
import { sendOrderConfirmation } from "./email.service";
import { logger } from "@/lib/logging";

export interface InitiateCheckoutInput {
  orderId: string;
  merchantTransactionId: string; // order.orderNumber
  amountMinor: number;
  currency: string;
  itemName: string;
  customer: { name: string; email: string; phone: string };
  returnUrl: string;
  continueSuccessUrl: string;
  cancelUrl: string;
}

/**
 * Create (or reuse) a pending payment for an order and ask the provider for a
 * checkout instruction (a form POST to PayWay, or a redirect for the fake
 * provider).
 */
export async function initiateCheckout(
  input: InitiateCheckoutInput,
): Promise<CheckoutInstruction> {
  const provider = getPaymentProvider();
  const paymentRepo = await getRepo(Payment);

  let payment = await paymentRepo.findOne({
    where: {
      provider: provider.name,
      merchantTransactionId: input.merchantTransactionId,
    },
  });
  if (!payment) {
    payment = paymentRepo.create({
      orderId: input.orderId,
      provider: provider.name,
      merchantTransactionId: input.merchantTransactionId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: PaymentStatus.PENDING,
    });
    await paymentRepo.save(payment);
  }

  const result = await provider.createCheckout({
    merchantTransactionId: input.merchantTransactionId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    itemName: input.itemName,
    customer: input.customer,
    returnUrl: input.returnUrl,
    continueSuccessUrl: input.continueSuccessUrl,
    cancelUrl: input.cancelUrl,
  });

  payment.rawRequest = result.rawRequest;
  await paymentRepo.save(payment);

  return result.instruction;
}

export interface ConfirmResult {
  ok: boolean;
  note: string;
}

/** Handle a provider callback (pushback). Extracts the txn id and confirms. */
export async function processCallback(
  rawBody: unknown,
): Promise<ConfirmResult> {
  const provider = getPaymentProvider();
  const { merchantTransactionId } = provider.parseCallback(rawBody);
  if (!merchantTransactionId) {
    logger.warn("Payment callback missing transaction id");
    return { ok: false, note: "no_transaction_id" };
  }
  return confirmPayment(
    merchantTransactionId,
    (rawBody ?? null) as Record<string, unknown> | null,
  );
}

/** Manual/scheduled reconciliation for a specific transaction. */
export async function reconcilePayment(
  merchantTransactionId: string,
): Promise<ConfirmResult> {
  return confirmPayment(merchantTransactionId, null);
}

/**
 * The single, idempotent confirmation path. Always verifies with the provider's
 * authoritative status query (never trusts the raw callback), checks the amount
 * and currency, then atomically marks the payment SUCCESS, the order PAID, and
 * its seats SOLD. Safe to call repeatedly (duplicate callbacks).
 */
export async function confirmPayment(
  merchantTransactionId: string,
  rawCallback: Record<string, unknown> | null,
): Promise<ConfirmResult> {
  const provider = getPaymentProvider();
  const paymentRepo = await getRepo(Payment);

  const payment = await paymentRepo.findOne({
    where: { provider: provider.name, merchantTransactionId },
  });
  if (!payment) {
    logger.warn("Callback for unknown payment", { merchantTransactionId });
    return { ok: true, note: "payment_not_found" };
  }
  if (payment.status === PaymentStatus.SUCCESS) {
    return { ok: true, note: "already_success" };
  }

  const statusResult = await provider.queryPaymentStatus(merchantTransactionId);
  payment.rawCallback = {
    callback: rawCallback,
    query: statusResult.raw,
  };

  if (statusResult.status !== "APPROVED") {
    if (statusResult.status === "DECLINED") {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = "Gateway declined the payment";
    } else if (statusResult.status === "CANCELLED") {
      payment.status = PaymentStatus.CANCELLED;
      payment.failureReason = "Payment cancelled";
    }
    await paymentRepo.save(payment);
    return { ok: true, note: `not_approved_${statusResult.status.toLowerCase()}` };
  }

  // Approved: verify amount + currency when the provider reports them.
  if (statusResult.amountMinor != null) {
    const currencyOk =
      !statusResult.currency ||
      statusResult.currency.toUpperCase() === payment.currency.toUpperCase();
    if (statusResult.amountMinor !== payment.amountMinor || !currencyOk) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = `Amount/currency mismatch: gateway ${statusResult.amountMinor} ${statusResult.currency ?? "?"} vs expected ${payment.amountMinor} ${payment.currency}`;
      await paymentRepo.save(payment);
      logger.error("Payment amount/currency mismatch — not confirming", {
        merchantTransactionId,
        gatewayAmountMinor: statusResult.amountMinor,
        expectedAmountMinor: payment.amountMinor,
      });
      return { ok: true, note: "amount_mismatch" };
    }
  }

  const ds = await getDataSource();
  const outcome = await ds.transaction(async (manager) => {
    const orderRows: Array<{ id: string; status: string }> = await manager.query(
      `SELECT id, status FROM orders WHERE id = $1 FOR UPDATE`,
      [payment.orderId],
    );
    const order = orderRows[0];
    if (!order) return "order_not_found";
    if (order.status === OrderStatus.PAID) return "already_paid";

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.PAYMENT_PROCESSING
    ) {
      // Money received but the reservation is gone (e.g. expired). Honor the
      // payment and flag for manual seat reassignment.
      await manager.query(
        `UPDATE orders SET status = 'PAID', paid_at = now(), updated_at = now() WHERE id = $1`,
        [payment.orderId],
      );
      logger.error(
        "CRITICAL: payment approved for a non-pending order; seats may need manual reassignment",
        { orderId: payment.orderId, previousStatus: order.status },
      );
      return "paid_needs_review";
    }

    await manager.query(
      `UPDATE seats SET status = 'SOLD', held_until = NULL, updated_at = now()
        WHERE order_id = $1 AND status = 'HELD'`,
      [payment.orderId],
    );
    await manager.query(
      `UPDATE orders SET status = 'PAID', paid_at = now(), updated_at = now() WHERE id = $1`,
      [payment.orderId],
    );
    // Issue one ticket per sold seat, in the same transaction (idempotent).
    await createTicketsForPaidOrder(manager, payment.orderId);
    return "paid";
  });

  payment.status = PaymentStatus.SUCCESS;
  payment.providerTransactionId =
    statusResult.providerTransactionId ?? payment.providerTransactionId;
  payment.paidAt = new Date();
  await paymentRepo.save(payment);

  logger.info("Payment confirmed", {
    merchantTransactionId,
    orderId: payment.orderId,
    outcome,
  });

  // Send the confirmation email once, only on the first transition to paid.
  // Email failure must not fail the confirmation (tickets already exist).
  if (outcome === "paid") {
    try {
      await sendOrderConfirmation(payment.orderId);
    } catch (error) {
      logger.error("Failed to send confirmation email", {
        orderId: payment.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, note: outcome };
}
