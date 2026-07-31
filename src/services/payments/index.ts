import type { PaymentProvider } from "./provider";
import { FakePaymentProvider } from "./fake-provider";
import { PayWayPaymentProvider } from "./payway-provider";

export * from "./provider";

let cached: PaymentProvider | undefined;

/**
 * Select the active payment provider from PAYMENT_PROVIDER
 * ("fake" | "payway"). Defaults to "fake" so local dev works out of the box;
 * set PAYMENT_PROVIDER=payway (with PAYWAY_* credentials) for sandbox/prod.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const name = (process.env.PAYMENT_PROVIDER ?? "fake").toLowerCase();
  cached = name === "payway" ? new PayWayPaymentProvider() : new FakePaymentProvider();
  return cached;
}
