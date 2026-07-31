/**
 * Money is always stored and computed as integer minor units (e.g. cents).
 * Never use floating-point arithmetic for monetary values.
 *
 * Example: amountMinor = 2500, currency = "USD" represents $25.00.
 */

/** Convert a major-unit amount (e.g. dollars) to integer minor units. */
export function toMinor(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

/** Sum any number of minor-unit amounts. */
export function sumMinor(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/** Multiply a unit price (minor units) by a whole quantity. */
export function multiplyMinor(unitPriceMinor: number, quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`quantity must be a non-negative integer, got ${quantity}`);
  }
  return unitPriceMinor * quantity;
}

/** Format minor units for display only. Does not mutate stored values. */
export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}
