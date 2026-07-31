/**
 * Lightweight same-origin check for state-changing requests. Combined with
 * SameSite=Lax cookies this is a reasonable CSRF defense for Phase 2; a
 * double-submit token is layered on with the admin forms in later phases.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Non-browser or same-origin navigations may omit Origin; only reject when a
  // cross-origin value is explicitly present.
  if (!origin) return true;

  const host = request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Best-effort client IP from common proxy headers (Cloud Run sets XFF). */
export function clientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}
