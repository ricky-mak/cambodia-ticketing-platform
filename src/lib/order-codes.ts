import crypto from "node:crypto";

// Crockford base32 (no I, L, O, U) to avoid ambiguous characters.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Human-friendly order number, e.g. "ORD-4KD9Q2AB". 8 base32 chars ≈ 1e12
 * possibilities — collision is negligible for a single event.
 */
export function generateOrderNumber(): string {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i]! % 32];
  }
  return `ORD-${code}`;
}

/** Unguessable token for public order/ticket URLs. */
export function generatePublicToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Human-friendly ticket number, e.g. "TKT-7Q2M9XAB". */
export function generateTicketNumber(): string {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i]! % 32];
  }
  return `TKT-${code}`;
}
