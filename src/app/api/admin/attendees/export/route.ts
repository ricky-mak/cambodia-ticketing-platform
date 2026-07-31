import { getAdminStaff } from "@/lib/api-auth";
import { getPrimaryEvent } from "@/services/event.service";
import { exportAttendeesCsv } from "@/services/admin-attendee.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const staff = await getAdminStaff();
  if (!staff) return new Response("Unauthorized", { status: 401 });

  const event = await getPrimaryEvent();
  if (!event) return new Response("No event", { status: 404 });

  const sp = new URL(request.url).searchParams;
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
