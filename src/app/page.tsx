import Link from "next/link";
import { getPublishedEvent } from "@/services/event.service";
import { listPublicZones } from "@/services/zone.service";
import { formatMoney } from "@/lib/money";
import { salesState, type SalesState } from "@/lib/sales";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

function formatUtc(date: Date | null): string | null {
  if (!date) return null;
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date) + " (UTC)"
  );
}

function salesClosedLabel(state: SalesState): string {
  switch (state) {
    case "BEFORE_START":
      return "Sales not open yet";
    case "AFTER_END":
      return "Sales ended";
    case "CLOSED":
      return "Sales closed";
    default:
      return "Unavailable";
  }
}

export default async function Home() {
  const event = await getPublishedEvent();

  if (!event) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-3 p-8">
        <h1 className="text-3xl font-bold tracking-tight">Event Ticketing</h1>
        <p className="text-muted-foreground">
          No event is on sale right now. Please check back soon.
        </p>
      </main>
    );
  }

  const zones = await listPublicZones(event.id);
  const start = formatUtc(event.startsAt);
  const sales = salesState(event);
  const salesOpen = sales === "OPEN";

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6 sm:p-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {event.name}
        </h1>
        {start && <p className="text-muted-foreground">{start}</p>}
        {event.venueName && (
          <p className="text-muted-foreground">
            {event.venueName}
            {event.venueAddress ? ` — ${event.venueAddress}` : ""}
          </p>
        )}
      </header>

      {event.heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.heroImageUrl}
          alt={event.name}
          className="w-full rounded-lg border object-cover"
        />
      )}

      {event.description && (
        <p className="whitespace-pre-line leading-relaxed">{event.description}</p>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Tickets</h2>
        {zones.length === 0 ? (
          <p className="text-muted-foreground">
            Ticket zones will be announced soon.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {zones.map(({ zone, counts }) => {
              const soldOut = counts.available <= 0;
              return (
                <Card key={zone.id}>
                  <CardHeader>
                    <CardTitle>{zone.name}</CardTitle>
                    <CardDescription>
                      {formatMoney(zone.priceMinor, zone.currency)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {zone.description && (
                      <p className="text-sm text-muted-foreground">
                        {zone.description}
                      </p>
                    )}
                    <p className="text-sm">
                      {soldOut
                        ? "Sold out"
                        : `${counts.available.toLocaleString()} seats available`}
                    </p>
                    {salesOpen && !soldOut ? (
                      <Link
                        href={`/checkout/${zone.id}`}
                        className={cn(buttonVariants(), "w-full")}
                      >
                        Buy tickets
                      </Link>
                    ) : (
                      <Button className="w-full" disabled>
                        {soldOut ? "Sold out" : salesClosedLabel(sales)}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {(event.refundPolicy || event.terms || event.contactEmail) && (
        <footer className="space-y-2 border-t pt-6 text-sm text-muted-foreground">
          {event.contactEmail && <p>Contact: {event.contactEmail}</p>}
          {event.refundPolicy && (
            <p className="whitespace-pre-line">{event.refundPolicy}</p>
          )}
          {event.terms && <p className="whitespace-pre-line">{event.terms}</p>}
        </footer>
      )}
    </main>
  );
}
