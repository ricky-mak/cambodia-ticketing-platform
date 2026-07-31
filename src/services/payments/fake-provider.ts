import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  PaymentStatusResult,
} from "./provider";

/**
 * Development/test payment provider. It never contacts a real gateway: instead
 * checkout redirects to an in-app "simulate payment" page, and status queries
 * report APPROVED. It exercises the exact same processCallback code path as the
 * real provider, so the pay → confirm pipeline can be tested without PayWay.
 *
 * Because it reports no amount, the payment service's amount check is skipped
 * for fake payments (the real provider always reports the amount).
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";

  async createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    return {
      instruction: {
        kind: "redirect",
        url: `/dev/pay/${encodeURIComponent(input.merchantTransactionId)}`,
      },
      rawRequest: {
        provider: "fake",
        merchantTransactionId: input.merchantTransactionId,
        amountMinor: input.amountMinor,
        currency: input.currency,
      },
    };
  }

  parseCallback(body: unknown): { merchantTransactionId: string | null } {
    const b = (body ?? {}) as Record<string, unknown>;
    const id =
      (b.tran_id as string) ??
      (b.merchantTransactionId as string) ??
      null;
    return { merchantTransactionId: id ? String(id) : null };
  }

  async queryPaymentStatus(
    merchantTransactionId: string,
  ): Promise<PaymentStatusResult> {
    // The fake always approves. Amount is intentionally omitted.
    return {
      status: "APPROVED",
      providerTransactionId: `FAKE-${merchantTransactionId}`,
      raw: { fake: true, merchantTransactionId },
    };
  }
}
