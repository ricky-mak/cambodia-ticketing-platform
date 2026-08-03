import { NextResponse } from "next/server";
import { clientIp } from "./http";

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Per the project constraints (no Redis), this is process-local: on Cloud Run
 * each instance keeps its own counters, so the effective limit is
 * (limit x number of instances). That's fine as a basic abuse/brute-force
 * guard. For a global limit, back it with Memorystore/Redis later.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 50_000;

function prune(now: number): void {
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size > MAX_KEYS) prune(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Enforce a rate limit for a request. Returns a 429 response if the caller is
 * over the limit, or null to continue. Keyed by bucket name + client IP.
 */
export function enforceRateLimit(
  request: Request,
  name: string,
  limit: number,
  windowMs: number,
  extraKey?: string,
): NextResponse | null {
  const ip = clientIp(request) ?? "unknown";
  const key = `${name}:${ip}${extraKey ? `:${extraKey}` : ""}`;
  const result = rateLimit(key, limit, windowMs);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}
