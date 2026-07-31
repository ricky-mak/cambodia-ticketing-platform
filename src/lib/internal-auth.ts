import { logger } from "@/lib/logging";

/**
 * Guards internal task endpoints. In production (Phase 9) these are called by
 * Cloud Tasks/Scheduler with OIDC; here we also accept a shared secret header
 * so the same routes can be exercised in dev and staging.
 *
 * - If INTERNAL_API_SECRET is set, the request must send a matching
 *   `x-internal-secret` header.
 * - If it is not set, requests are allowed only outside production (dev
 *   convenience) and rejected in production.
 */
export function assertInternalRequest(request: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  const provided = request.headers.get("x-internal-secret");

  if (secret) {
    return provided === secret;
  }

  if (process.env.NODE_ENV === "production") {
    logger.error(
      "INTERNAL_API_SECRET is not set in production; rejecting internal request",
    );
    return false;
  }
  return true;
}
