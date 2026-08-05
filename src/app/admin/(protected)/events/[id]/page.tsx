import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EventForm, type EventFormValues } from "@/components/admin/event-form";
import { EventStatusControl } from "@/components/admin/event-status-control";
import { getAdminContext } from "@/lib/admin-context";
import { getEventById } from "@/services/event.service";
import { inScope } from "@/lib/tenant";
import { toDateTimeLocal } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function EventEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");

  const { id } = await params;
  const event = await getEventById(id);
  if (!event || !inScope(ctx.scope, event.organizerId)) notFound();

  const initial: EventFormValues = {
    id: event.id,
    name: event.name,
    slug: event.slug,
    currency: event.currency,
    venueName: event.venueName ?? "",
    venueAddress: event.venueAddress ?? "",
    description: event.description ?? "",
    heroImageUrl: event.heroImageUrl ?? "",
    heroImageFull: event.heroImageFull,
    contactEmail: event.contactEmail ?? "",
    contactPhone: event.contactPhone ?? "",
    startsAt: toDateTimeLocal(event.startsAt),
    endsAt: toDateTimeLocal(event.endsAt),
    salesStartAt: toDateTimeLocal(event.salesStartAt),
    salesEndAt: toDateTimeLocal(event.salesEndAt),
    reservationMinutes: event.reservationMinutes ?? 10,
    maxPendingPerEmail: event.maxPendingPerEmail ?? 3,
    maxPendingPerIp: event.maxPendingPerIp ?? 20,
    refundPolicy: event.refundPolicy ?? "",
    terms: event.terms ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/events"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All events
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight">
          {event.name}
        </h1>
      </div>

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
