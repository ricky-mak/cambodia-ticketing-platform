import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EventForm, type EventFormValues } from "@/components/admin/event-form";
import { getAdminContext } from "@/lib/admin-context";

export const dynamic = "force-dynamic";

const BLANK: EventFormValues = {
  name: "",
  slug: "",
  currency: "USD",
  venueName: "",
  venueAddress: "",
  description: "",
  heroImageUrl: "",
  contactEmail: "",
  contactPhone: "",
  startsAt: "",
  endsAt: "",
  salesStartAt: "",
  salesEndAt: "",
  reservationMinutes: 10,
  maxPendingPerEmail: 3,
  maxPendingPerIp: 20,
  refundPolicy: "",
  terms: "",
};

export default async function EventsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  const { events, activeEvent } = ctx;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight">Events</h1>
        <p className="text-muted-foreground">
          Manage your events. Pick the active event from the selector in the
          header to work on its zones, orders and attendees.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {events.length} event{events.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events yet. Create your first event below.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Slug</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-medium">
                        {e.name}
                        {activeEvent?.id === e.id && (
                          <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {e.slug}
                      </td>
                      <td className="py-2.5 pr-4">{e.status}</td>
                      <td className="py-2.5 text-right">
                        <Link
                          href={`/admin/events/${e.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create event</CardTitle>
          <CardDescription>
            Publish it from its manage page once zones are configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm initial={BLANK} />
        </CardContent>
      </Card>
    </div>
  );
}
