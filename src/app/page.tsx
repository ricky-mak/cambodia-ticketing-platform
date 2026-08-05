import Link from "next/link";
import { listPublishedEventsForMarketplace } from "@/services/event.service";
import { SailMotif } from "@/components/brand/sail-motif";
import { Card, CardContent } from "@/components/ui/card";
import { APP_TZ } from "@/lib/datetime";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: APP_TZ,
  }).format(date);
}

export default async function Home() {
  const events = await listPublishedEventsForMarketplace();

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-deep text-white">
        <SailMotif className="pointer-events-none absolute -right-4 -top-2 text-gold/40" />
        <div className="mx-auto max-w-5xl px-6 py-14 sm:px-10 sm:py-20">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-rose" />
            Live in Cambodia
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold leading-[1.05] sm:text-5xl">
            Upcoming events
          </h1>
          <p className="mt-4 max-w-xl text-sm text-white/80">
            Book tickets to events at Morodok Techo National Stadium and beyond.
          </p>
          <div className="mt-6 h-[3px] w-16 rounded bg-gold" />
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
        {events.length === 0 ? (
          <p className="text-muted-foreground">
            No events are on sale right now. Please check back soon.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const date = formatDate(event.startsAt);
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="group block"
                >
                  <Card className="flex h-full flex-col overflow-hidden shadow-sm transition-shadow group-hover:shadow-md">
                    {event.heroImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.heroImageUrl}
                        alt={event.name}
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="relative h-40 w-full overflow-hidden bg-brand-deep">
                        <SailMotif className="absolute -right-2 top-1 text-gold/30" />
                      </div>
                    )}
                    <CardContent className="flex flex-1 flex-col gap-2 pt-5">
                      <h2 className="font-serif text-xl font-bold leading-tight">
                        {event.name}
                      </h2>
                      {date && (
                        <p className="text-sm text-muted-foreground">{date}</p>
                      )}
                      {event.venueName && (
                        <p className="text-sm text-muted-foreground">
                          {event.venueName}
                        </p>
                      )}
                      <span className="mt-auto pt-2 text-sm font-semibold text-brand group-hover:underline">
                        View tickets →
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
