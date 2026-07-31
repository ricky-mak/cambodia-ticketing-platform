/**
 * Provider-agnostic payment abstraction. The rest of the app depends only on
 * this interface; PayWay-specific details live in payway-provider.ts.
 */

export type ProviderPaymentStatus =
  | "APPROVED"
  | "PENDING"
  | "DECLINED"
  | "REFUNDED"
  | "CANCELLED"
  | "UNKNOWN";

export interface CreateCheckoutInput {
  /** Unique merchant transaction id (PayWay tran_id, ≤ 20 chars). */
  merchantTransactionId: string;
  amountMinor: number;
  currency: string;
  itemName: string;
  customer: { name: string; email: string; phone: string };
  /** Server-to-server callback URL (PayWay return_url). */
  returnUrl: string;
  /** Where the browser lands after a successful payment. */
  continueSuccessUrl: string;
  /** Where the browser lands if the payer cancels. */
  cancelUrl: string;
}

export type CheckoutInstruction =
  | { kind: "form_post"; action: string; fields: Record<string, string> }
  | { kind: "redirect"; url: string };

export interface CreateCheckoutResult {
  instruction: CheckoutInstruction;
  rawRequest: Record<string, unknown>;
}

export interface PaymentStatusResult {
  status: ProviderPaymentStatus;
  /** Present when the provider reports it (PayWay does; the fake does not). */
  amountMinor?: number;
  currency?: string;
  providerTransactionId?: string | null;
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  /** Extract the merchant transaction id from a raw callback body. */
  parseCallback(body: unknown): { merchantTransactionId: string | null };
  /** Authoritative status lookup (the source of truth for confirmation). */
  queryPaymentStatus(merchantTransactionId: string): Promise<PaymentStatusResult>;
}
