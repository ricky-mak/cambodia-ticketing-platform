import { getScopedAdminStaff } from "@/lib/api-auth";
import { inScope } from "@/lib/tenant";
import { getEventById } from "@/services/event.service";
import { exportAttendeesCsv } from "@/services/admin-attendee.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gated = await getScopedAdminStaff();
  if (!gated) return new Response("Unauthorized", { status: 401 });
  const { scope } = gated;

  const sp = new URL(request.url).searchParams;
  const eventId = sp.get("event");
  if (!eventId) return new Response("Missing event", { status: 400 });

  const event = await getEventById(eventId);
  if (!event) return new Response("No event", { status: 404 });
  if (!inScope(scope, event.organizerId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const checkedInParam = sp.get("checkedIn");
  const csv = await exportAttendeesCsv({
    eventId: event.id,
    q: sp.get("q") ?? undefined,
    zoneId: sp.get("zoneId") ?? undefined,
    checkedIn:
      checkedInParam === "checked_in" || checkedInParam === "not_checked_in"
        ? checkedInParam
        : undefined,
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendees-${event.slug}.csv"`,
    },
  });
}
