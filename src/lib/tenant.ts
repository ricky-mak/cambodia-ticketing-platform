import type { StaffUser } from "@/entities/staff-user.entity";

/**
 * The tenant a request operates within.
 *
 * - `isPlatform` — the caller is platform-level staff (organizer_id NULL). They
 *   may act across all organizers (and manage organizers themselves).
 * - `organizerId` — for organizer-scoped staff, the single organizer they are
 *   bound to. `null` for platform staff.
 *
 * This is the single source of truth for "who can see what". Organizer-scoped
 * queries MUST filter by `organizerId`; platform staff see everything (or an
 * explicitly chosen organizer). See docs/multi-tenant-plan.md §3.
 */
export interface TenantScope {
  isPlatform: boolean;
  organizerId: string | null;
}

export function getTenantScope(staff: StaffUser): TenantScope {
  const organizerId = staff.organizerId ?? null;
  return { isPlatform: organizerId === null, organizerId };
}

/**
 * Resolve the organizer_id a query should be constrained to.
 *
 * - Organizer-scoped staff: always their own organizer (any `requested` value
 *   that isn't theirs is rejected → returns their own).
 * - Platform staff: the `requested` organizer if given, else `null` meaning
 *   "no constraint / all organizers".
 *
 * Returns `undefined` when an organizer-scoped caller has no organizer bound
 * (a data error) so callers can refuse rather than leak.
 */
export function resolveOrganizerFilter(
  scope: TenantScope,
  requested?: string | null,
): string | null | undefined {
  if (scope.isPlatform) {
    return requested ?? null;
  }
  if (!scope.organizerId) return undefined;
  return scope.organizerId;
}
