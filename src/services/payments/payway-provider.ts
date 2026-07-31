import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  PaymentStatusResult,
  ProviderPaymentStatus,
} from "./provider";
import {
  buildPurchaseHashBase,
  checkTransactionHash,
  formatPayWayAmount,
  payWayAmountToMinor,
  payWayHmac,
  payWayReqTime,
} from "@/lib/payway-hash";
import { logger } from "@/lib/logging";

/**
 * ABA PayWay adapter (hosted checkout), built from ABA's developer docs:
 *   POST {base}/api/payment-gateway/v1/payments/purchase            (multipart form)
 *   POST {base}/api/payment-gateway/v1/payments/check-transaction-2 (json)
 *
 * PayWay's pushback to return_url is unsigned and omits the amount, so it is
 * only a "check now" trigger — confirmation always goes through
 * queryPaymentStatus() (check-transaction), which we sign.
 */

const PURCHASE_PATH = "/api/payment-gateway/v1/payments/purchase";
const CHECK_PATH = "/api/payment-gateway/v1/payments/check-transaction-2";

interface PayWayConfig {
  merchantId: string;
  apiKey: string;
  baseUrl: string;
}

function loadConfig(): PayWayConfig {
  const merchantId = process.env.PAYWAY_MERCHANT_ID;
  const apiKey = process.env.PAYWAY_API_KEY;
  const baseUrl = (
    process.env.PAYWAY_BASE_URL ?? "https://checkout-sandbox.payway.com.kh"
  ).replace(/\/$/, "");
  if (!merchantId || !apiKey) {
    throw new Error(
      "PAYWAY_MERCHANT_ID and PAYWAY_API_KEY must be set to use the PayWay provider.",
    );
  }
  return { merchantId, apiKey, baseUrl };
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

function mapStatus(paymentStatus: string): ProviderPaymentStatus {
  switch (paymentStatus) {
    case "APPROVED":
    case "PRE-AUTH":
      return "APPROVED";
    case "PENDING":
      return "PENDING";
    case "DECLINED":
      return "DECLINED";
    case "REFUNDED":
      return "REFUNDED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "UNKNOWN";
  }
}

export class PayWayPaymentProvider implements PaymentProvider {
  readonly name = "payway";

  async createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const cfg = loadConfig();
    const reqTime = payWayReqTime();
    const amount = formatPayWayAmount(input.amountMinor, input.currency);
    const { first, last } = splitName(input.customer.name);
    const currency = input.currency.toUpperCase();
    const type = "purchase";

    const items = Buffer.from(
      JSON.stringify([
        { name: input.itemName, quantity: 1, price: Number(amount) },
      ]),
    ).toString("base64");
    // Per docs, return_url is Base64-encoded.
    const returnUrl = Buffer.from(input.returnUrl).toString("base64");

    const hashFields = {
      reqTime,
      merchantId: cfg.merchantId,
      tranId: input.merchantTransactionId,
      amount,
      items,
      firstname: first,
      lastname: last,
      email: input.customer.email,
      phone: input.customer.phone,
      type,
      returnUrl,
      cancelUrl: input.cancelUrl,
      continueSuccessUrl: input.continueSuccessUrl,
      currency,
    };
    const hash = payWayHmac(buildPurchaseHashBase(hashFields), cfg.apiKey);

    // Only non-empty fields are posted; the hash treats omitted fields as "".
    const fields: Record<string, string> = {
      req_time: reqTime,
      merchant_id: cfg.merchantId,
      tran_id: input.merchantTransactionId,
      amount,
      items,
      firstname: first,
      lastname: last,
      email: input.customer.email,
      phone: input.customer.phone,
      type,
      return_url: returnUrl,
      cancel_url: input.cancelUrl,
      continue_success_url: input.continueSuccessUrl,
      currency,
      hash,
      // Not part of the hash. Force the hosted Checkout service (full HTML page)
      // rather than the QR Payment API — required when the merchant profile also
      // has the QR Payment service enabled, otherwise PayWay returns raw JSON.
      payment_gate: "0",
      view_type: "hosted_view",
    };

    return {
      instruction: {
        kind: "form_post",
        action: `${cfg.baseUrl}${PURCHASE_PATH}`,
        fields,
      },
      // Never persist the api key or hash.
      rawRequest: {
        req_time: reqTime,
        merchant_id: cfg.merchantId,
        tran_id: input.merchantTransactionId,
        amount,
        currency,
      },
    };
  }

  parseCallback(body: unknown): { merchantTransactionId: string | null } {
    const b = (body ?? {}) as Record<string, unknown>;
    const id = b.tran_id;
    return { merchantTransactionId: id != null ? String(id) : null };
  }

  async queryPaymentStatus(
    merchantTransactionId: string,
  ): Promise<PaymentStatusResult> {
    const cfg = loadConfig();
    const reqTime = payWayReqTime();
    const hash = checkTransactionHash(
      reqTime,
      cfg.merchantId,
      merchantTransactionId,
      cfg.apiKey,
    );

    const res = await fetch(`${cfg.baseUrl}${CHECK_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        req_time: reqTime,
        merchant_id: cfg.merchantId,
        tran_id: merchantTransactionId,
        hash,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      data?: {
        payment_status?: string;
        payment_amount?: number;
        payment_currency?: string;
        apv?: string;
      };
      status?: { code?: string | number; message?: string };
    };

    const data = json.data;
    if (!data || !data.payment_status) {
      logger.warn("PayWay check-transaction returned no data", {
        merchantTransactionId,
        code: json.status?.code,
      });
      return { status: "UNKNOWN", raw: json as Record<string, unknown> };
    }

    const currency = data.payment_currency || undefined;
    const amountMinor =
      typeof data.payment_amount === "number" && currency
        ? payWayAmountToMinor(data.payment_amount)
        : undefined;

    return {
      status: mapStatus(data.payment_status),
      amountMinor,
      currency,
      providerTransactionId: data.apv || null,
      raw: json as Record<string, unknown>,
    };
  }
}
