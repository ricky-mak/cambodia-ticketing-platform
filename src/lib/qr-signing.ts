import crypto from "node:crypto";

/**
 * Signed QR ticket tokens.
 *
 * Token format:  base64url(payload) + "." + base64url(HMAC_SHA256(payloadB64))
 *
 * The payload carries only opaque identifiers — never customer data. The
 * database is the source of truth for validity at check-in; the signature just
 * proves the QR was issued by us and hasn't been tampered with.
 */
export interface TicketTokenPayload {
  version: number;
  ticketId: string;
  eventId: string;
  tokenId: string;
}

function getSecret(explicit?: string): string {
  const secret = explicit ?? process.env.TICKET_SIGNING_SECRET;
  if (!secret) {
    throw new Error("TICKET_SIGNING_SECRET is not set");
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signTicketToken(
  payload: TicketTokenPayload,
  secret?: string,
): string {
  const key = getSecret(secret);
  const payloadB64 = b64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", key)
    .update(payloadB64)
    .digest();
  return `${payloadB64}.${b64url(signature)}`;
}

/** Verify a token and return its payload, or null if invalid/tampered. */
export function verifyTicketToken(
  token: string,
  secret?: string,
): TicketTokenPayload | null {
  const key = getSecret(secret);
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return null;

  const expected = crypto
    .createHmac("sha256", key)
    .update(payloadB64)
    .digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(signatureB64, "base64url");
  } catch {
    return null;
  }
  // timingSafeEqual requires equal lengths; check first to avoid throwing.
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as TicketTokenPayload;
    if (payload.version !== 1) return null;
    if (!payload.ticketId || !payload.eventId || !payload.tokenId) return null;
    return payload;
  } catch {
    return null;
  }
}
