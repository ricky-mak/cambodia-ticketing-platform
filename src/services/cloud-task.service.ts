import { logger } from "@/lib/logging";

/**
 * Abstraction over delayed task scheduling.
 *
 * In production (Phase 9) this will enqueue a Google Cloud Task that calls the
 * protected internal endpoint (e.g. POST /api/internal/orders/{id}/expire) via
 * OIDC at the scheduled time. In development there is no Cloud Tasks emulator,
 * so this is a no-op and expiration is handled by the scheduled sweeper
 * (POST /api/internal/orders/sweep-expired, `yarn sweep-expired` in dev,
 * Cloud Scheduler ~1 min in prod). Expired holds are reclaimed only by that
 * sweep — createReservation no longer reclaims inline (removed for contention).
 */
export async function scheduleOrderExpiration(
  orderId: string,
  runAt: Date,
): Promise<void> {
  logger.info("scheduleOrderExpiration (dev no-op)", {
    orderId,
    runAt: runAt.toISOString(),
  });
}
