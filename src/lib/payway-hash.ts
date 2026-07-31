import crypto from "node:crypto";

/**
 * Pure ABA PayWay hashing/formatting helpers (no app dependencies) so the
 * signature logic can be unit tested in isolation.
 *
 * Hash = base64(HMAC_SHA512(<ordered concat>, api_key)).
 */

// Currencies with no minor unit (amount must be an integer at PayWay).
export const ZERO_DECIMAL_CURRENCIES = new Set(["KHR", "JPY", "VND"]);

/** amountMinor is stored uniformly as hundredths, even for zero-decimal currencies. */
export function formatPayWayAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? String(Math.round(major))
    : major.toFixed(2);
}

/** Provider major amount -> our stored minor (hundredths). */
export function payWayAmountToMinor(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

export function payWayReqTime(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
  );
}

export function payWayHmac(base: string, apiKey: string): string {
  return crypto.createHmac("sha512", apiKey).update(base, "utf8").digest("base64");
}

/**
 * Fields for the purchase hash, in the EXACT order ABA concatenates them.
 * Omitted fields contribute an empty string. `view_type` and `payment_gate`
 * are deliberately excluded (ABA does not include them in the hash).
 */
export interface PurchaseHashFields {
  reqTime: string;
  merchantId: string;
  tranId: string;
  amount: string;
  items?: string;
  shipping?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  type?: string;
  paymentOption?: string;
  returnUrl?: string;
  cancelUrl?: string;
  continueSuccessUrl?: string;
  returnDeeplink?: string;
  currency?: string;
  customFields?: string;
  returnParams?: string;
  payout?: string;
  lifetime?: string;
  additionalParams?: string;
  googlePayToken?: string;
  skipSuccessPage?: string;
}

export function buildPurchaseHashBase(f: PurchaseHashFields): string {
  const e = (v: string | undefined) => v ?? "";
  return (
    f.reqTime +
    f.merchantId +
    f.tranId +
    f.amount +
    e(f.items) +
    e(f.shipping) +
    e(f.firstname) +
    e(f.lastname) +
    e(f.email) +
    e(f.phone) +
    e(f.type) +
    e(f.paymentOption) +
    e(f.returnUrl) +
    e(f.cancelUrl) +
    e(f.continueSuccessUrl) +
    e(f.returnDeeplink) +
    e(f.currency) +
    e(f.customFields) +
    e(f.returnParams) +
    e(f.payout) +
    e(f.lifetime) +
    e(f.additionalParams) +
    e(f.googlePayToken) +
    e(f.skipSuccessPage)
  );
}

export function purchaseHash(f: PurchaseHashFields, apiKey: string): string {
  return payWayHmac(buildPurchaseHashBase(f), apiKey);
}

/** check-transaction-2 hash = base64(hmac_sha512(req_time + merchant_id + tran_id)). */
export function checkTransactionHash(
  reqTime: string,
  merchantId: string,
  tranId: string,
  apiKey: string,
): string {
  return payWayHmac(reqTime + merchantId + tranId, apiKey);
}
