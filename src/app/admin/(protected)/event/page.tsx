import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EventForm, type EventFormValues } from "@/components/admin/event-form";
import { EventStatusControl } from "@/components/admin/event-status-control";
import { getPrimaryEvent } from "@/services/event.service";
import { toDateTimeLocal } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function EventSettingsPage() {
  const event = await getPrimaryEvent();

  const initial: EventFormValues = {
    id: event?.id,
    name: event?.name ?? "",
    slug: event?.slug ?? "",
    currency: event?.currency ?? "USD",
    venueName: event?.venueName ?? "",
    venueAddress: event?.venueAddress ?? "",
    description: event?.description ?? "",
    heroImageUrl: event?.heroImageUrl ?? "",
    contactEmail: event?.contactEmail ?? "",
    contactPhone: event?.contactPhone ?? "",
    startsAt: toDateTimeLocal(event?.startsAt),
    endsAt: toDateTimeLocal(event?.endsAt),
    salesStartAt: toDateTimeLocal(event?.salesStartAt),
    salesEndAt: toDateTimeLocal(event?.salesEndAt),
    reservationMinutes: event?.reservationMinutes ?? 10,
    maxPendingPerEmail: event?.maxPendingPerEmail ?? 3,
    maxPendingPerIp: event?.maxPendingPerIp ?? 20,
    refundPolicy: event?.refundPolicy ?? "",
    terms: event?.terms ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Event settings</h1>
        <p className="text-muted-foreground">
          {event
            ? "Edit event details and control its publication status."
            : "Create the event. Publish it once zones are configured."}
        </p>
      </div>

      {event && (
        <Card>
          <CardHeader>
            <CardTitle>Publication</CardTitle>
            <CardDescription>
              Only a PUBLISHED event is visible on the public page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventStatusControl eventId={event.id} status={event.status} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm initial={initial} />
        </CardContent>
      </Card>
    </div>
  );
}
