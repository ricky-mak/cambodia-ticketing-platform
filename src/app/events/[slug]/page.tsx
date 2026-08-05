import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedEventBySlug } from "@/services/event.service";
import { listPublicZones } from "@/services/zone.service";
import { formatMoney } from "@/lib/money";
import { salesState, type SalesState } from "@/lib/sales";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { SailMotif } from "@/components/brand/sail-motif";
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

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(slug);
  if (!event) notFound();

  const zones = await listPublicZones(event.id);
  const start = formatUtc(event.startsAt);
  const sales = salesState(event);
  const salesOpen = sales === "OPEN";

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-deep text-white">
        <SailMotif className="pointer-events-none absolute -right-4 -top-2 text-gold/40" />
        <div className="mx-auto max-w-4xl px-6 py-14 sm:px-10 sm:py-20">
          <Link
            href="/"
            className="text-xs font-medium text-white/70 transition-colors hover:text-white"
          >
            ← All events
          </Link>
          <p className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-rose" />
            {event.venueName || "Live event"}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold leading-[1.05] sm:text-5xl">
            {event.name}
          </h1>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/80">
            {start && <span>{start}</span>}
            {event.venueAddress && <span>{event.venueAddress}</span>}
          </div>
          <div className="mt-6 h-[3px] w-16 rounded bg-gold" />
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-10 px-6 py-10 sm:px-10">
        {event.heroImageUrl &&
          (event.heroImageFull ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.heroImageUrl}
              alt={event.name}
              className="w-full rounded-xl border object-cover shadow-sm"
            />
          ) : (
            <div className="aspect-video w-full overflow-hidden rounded-xl border shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.heroImageUrl}
                alt={event.name}
                className="h-full w-full object-cover"
              />
            </div>
          ))}

        {event.description && (
          <p className="max-w-2xl whitespace-pre-line leading-relaxed text-foreground/90">
            {event.description}
          </p>
        )}

        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Tickets</h2>
          {zones.length === 0 ? (
            <p className="text-muted-foreground">
              Ticket zones will be announced soon.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {zones.map(({ zone, counts }) => {
                const soldOut = counts.available <= 0;
                return (
                  <Card key={zone.id} className="flex flex-col shadow-sm">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="font-serif text-xl">
                          {zone.name}
                        </CardTitle>
                        {soldOut ? (
                          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            Sold out
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success ring-1 ring-inset ring-success/20">
                            Available
                          </span>
                        )}
                      </div>
                      <CardDescription className="pt-1 text-lg font-bold text-rose">
                        {formatMoney(zone.priceMinor, zone.currency)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto space-y-3">
                      {zone.description && (
                        <p className="text-sm text-muted-foreground">
                          {zone.description}
                        </p>
                      )}
                      <p className="text-sm">
                        {soldOut
                          ? "No seats remaining"
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
      </div>
    </main>
  );
}
