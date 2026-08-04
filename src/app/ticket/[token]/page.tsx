import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { SailMotif } from "@/components/brand/sail-motif";
import { getTicketByPublicToken } from "@/services/ticket.service";
import { TicketStatus } from "@/types/enums";

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

export default async function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getTicketByPublicToken(token);
  if (!view) notFound();

  const { ticket, event, zone, seat } = view;
  const valid = ticket.status === TicketStatus.VALID;
  const checkedIn = ticket.status === TicketStatus.CHECKED_IN;

  return (
    <main className="mx-auto max-w-md p-6 sm:p-10">
      <Card className="overflow-hidden shadow-sm">
        <div className="relative overflow-hidden bg-brand-deep px-6 py-5 text-white">
          <SailMotif className="pointer-events-none absolute -right-3 -top-2 text-gold/40" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            Admit one
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight">
            {event.name}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {formatUtc(event.startsAt) ?? "Date to be announced"}
            {event.venueName ? ` · ${event.venueName}` : ""}
          </p>
        </div>
        <CardContent className="space-y-5 pt-6">
          <div>
            {valid && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success ring-1 ring-inset ring-success/20">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Valid ticket
              </span>
            )}
            {checkedIn && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Already checked in
              </span>
            )}
            {!valid && !checkedIn && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive ring-1 ring-inset ring-destructive/20">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {ticket.status.toLowerCase()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Zone</p>
              <p className="font-medium">{zone.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Seat</p>
              <p className="font-medium">
                Row {seat.rowLabel}, Seat {seat.seatNumber}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Attendee</p>
              <p className="font-medium">{ticket.attendeeName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ticket</p>
              <p className="font-medium">{ticket.ticketNumber}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/40 p-5">
            {valid ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/tickets/${token}/qr`}
                  alt="Ticket QR code"
                  width={240}
                  height={240}
                  className="h-60 w-60 rounded-lg bg-white p-2 shadow-sm"
                />
                <p className="text-center text-xs text-muted-foreground">
                  Present this QR code at the entrance.
                </p>
              </>
            ) : checkedIn ? (
              <p className="text-center text-sm font-semibold text-amber-700">
                Checked in
                {ticket.checkedInAt
                  ? ` at ${formatUtc(ticket.checkedInAt)}`
                  : ""}
              </p>
            ) : (
              <p className="text-center text-sm font-semibold text-destructive">
                This ticket is {ticket.status.toLowerCase()} and cannot be used.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
