import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <Card>
        <CardHeader>
          <CardTitle>{event.name}</CardTitle>
          <CardDescription>
            {formatUtc(event.startsAt) ?? "Date to be announced"}
            {event.venueName ? ` · ${event.venueName}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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

          <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
            {valid ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/tickets/${token}/qr`}
                  alt="Ticket QR code"
                  width={240}
                  height={240}
                  className="h-60 w-60"
                />
                <p className="text-center text-xs text-muted-foreground">
                  Present this QR code at the entrance.
                </p>
              </>
            ) : checkedIn ? (
              <p className="text-center font-semibold text-orange-600">
                Already checked in
                {ticket.checkedInAt
                  ? ` at ${formatUtc(ticket.checkedInAt)}`
                  : ""}
              </p>
            ) : (
              <p className="text-center font-semibold text-destructive">
                This ticket is {ticket.status.toLowerCase()} and cannot be used.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
