import { cookies } from "next/headers";
import { getScopedAdminStaff } from "@/lib/api-auth";
import { listEventsForScope, getEventById } from "@/services/event.service";
import { ACTIVE_EVENT_COOKIE } from "@/lib/active-event-cookie";
import type { Event } from "@/entities/event.entity";
import type { StaffUser } from "@/entities/staff-user.entity";
import type { TenantScope } from "@/lib/tenant";

// The active-event cookie name lives in its own module (see import above) so
// client components can use it without importing this server-only file.
export { ACTIVE_EVENT_COOKIE };

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
