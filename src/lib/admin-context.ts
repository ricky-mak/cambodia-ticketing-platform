import { cookies } from "next/headers";
import { getScopedAdminStaff } from "@/lib/api-auth";
import { listEventsForScope, getEventById } from "@/services/event.service";
import type { Event } from "@/entities/event.entity";
import type { StaffUser } from "@/entities/staff-user.entity";
import type { TenantScope } from "@/lib/tenant";

/**
 * Cookie remembering which event the admin is currently working on. It's only a
 * hint: the server always re-validates that the chosen event is within the
 * caller's tenant scope, so a tampered cookie can never widen access.
 */
export const ACTIVE_EVENT_COOKIE = "admin_active_event";

export interface EventOption {
  id: string;
  name: string;
  slug: string;
  status: string;
  organizerId: string;
}

export interface AdminContext {
  staff: StaffUser;
  scope: TenantScope;
  /** Events the caller may work on (organizer-scoped; all for platform). */
  events: EventOption[];
  /** The selected event (from cookie, validated in scope) or the first, or null. */
  activeEvent: Event | null;
}

/**
 * Resolves the admin's tenant scope, the events they may see, and the currently
 * active event. Returns null if the caller isn't an admin (caller redirects).
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const gated = await getScopedAdminStaff();
  if (!gated) return null;
  const { staff, scope } = gated;

  const all = await listEventsForScope(scope.organizerId);
  const events: EventOption[] = all.map((e) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    status: e.status,
    organizerId: e.organizerId,
  }));

  let activeEvent: Event | null = null;
  if (events.length > 0) {
    const store = await cookies();
    const cookieId = store.get(ACTIVE_EVENT_COOKIE)?.value;
    const chosenId =
      cookieId && events.some((e) => e.id === cookieId)
        ? cookieId
        : events[0].id;
    activeEvent = await getEventById(chosenId);
  }

  return { staff, scope, events, activeEvent };
}
