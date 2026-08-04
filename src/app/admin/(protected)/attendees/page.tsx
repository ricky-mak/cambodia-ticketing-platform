import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AttendeeActions } from "@/components/admin/attendee-actions";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-context";
import { listZonesWithCounts } from "@/services/zone.service";
import { searchAttendees } from "@/services/admin-attendee.service";

export const dynamic = "force-dynamic";

export default async function AttendeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; zoneId?: string; checkedIn?: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  const event = ctx.activeEvent;
  if (!event) {
    return <p className="text-muted-foreground">Create an event first.</p>;
  }
  const { q, zoneId, checkedIn } = await searchParams;
  const zones = await listZonesWithCounts(event.id);
  const checkedInFilter =
    checkedIn === "checked_in" || checkedIn === "not_checked_in"
      ? checkedIn
      : undefined;
  const attendees = await searchAttendees({
    eventId: event.id,
    q,
    zoneId: zoneId || undefined,
    checkedIn: checkedInFilter,
  });

  const exportQuery = new URLSearchParams();
  exportQuery.set("event", event.id);
  if (q) exportQuery.set("q", q);
  if (zoneId) exportQuery.set("zoneId", zoneId);
  if (checkedInFilter) exportQuery.set("checkedIn", checkedInFilter);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Attendees</h1>
        <a
          className="text-sm underline"
          href={`/api/admin/attendees/export?${exportQuery.toString()}`}
        >
          Export CSV
        </a>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Name, email, ticket #, order #"
          className="max-w-xs"
        />
        <select
          name="zoneId"
          defaultValue={zoneId ?? ""}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All zones</option>
          {zones.map(({ zone }) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
        <select
          name="checkedIn"
          defaultValue={checkedIn ?? ""}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Any check-in</option>
          <option value="checked_in">Checked in</option>
          <option value="not_checked_in">Not checked in</option>
        </select>
        <Button type="submit">Filter</Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{attendees.length} attendee(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Attendee</th>
                  <th className="py-2 pr-4">Zone / Seat</th>
                  <th className="py-2 pr-4">Ticket</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a.ticketId} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {a.attendeeName}
                      <div className="text-xs text-muted-foreground">
                        {a.attendeeEmail}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      {a.zoneName} · {a.seatLabel}
                    </td>
                    <td className="py-2 pr-4">
                      <Link
                        className="underline"
                        href={`/ticket/${a.publicToken}`}
                      >
                        {a.ticketNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{a.status}</td>
                    <td className="py-2 pr-4">
                      <AttendeeActions ticketId={a.ticketId} status={a.status} />
                    </td>
                  </tr>
                ))}
                {attendees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-muted-foreground">
                      No attendees match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
