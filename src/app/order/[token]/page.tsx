import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReservationCountdown } from "@/components/reservation-countdown";
import { OrderStatusPoller } from "@/components/order-status-poller";
import { getOrderByPublicToken } from "@/services/order.service";
import { getTicketSummariesForOrder } from "@/services/ticket.service";
import { formatMoney } from "@/lib/money";
import { OrderStatus } from "@/types/enums";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getOrderByPublicToken(token);
  if (!view) notFound();

  const { order, items, seats } = view;
  const isPending = order.status === OrderStatus.PENDING;
  const isExpired = order.status === OrderStatus.EXPIRED;
  const isPaid = order.status === OrderStatus.PAID;
  const ticketSummaries = isPaid
    ? await getTicketSummariesForOrder(order.id)
    : [];

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 sm:p-10">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight">
          Your order
        </h1>
        <p className="text-muted-foreground">Order {order.orderNumber}</p>
      </div>

      {isPending && <OrderStatusPoller token={token} />}

      {isPending && order.reservationExpiresAt && (
        <Card>
          <CardHeader>
            <CardTitle>Awaiting payment</CardTitle>
            <CardDescription>
              Seats held for{" "}
              <ReservationCountdown
                expiresAt={order.reservationExpiresAt.toISOString()}
              />
              . Complete payment before the timer runs out.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {isPaid && (
        <Card>
          <CardHeader>
            <CardTitle className="text-success">Payment confirmed</CardTitle>
            <CardDescription>
              Your seats are booked and your tickets have been emailed to you.
            </CardDescription>
          </CardHeader>
          {ticketSummaries.length > 0 && (
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">Your tickets</p>
              {ticketSummaries.map((t) => (
                <Link
                  key={t.publicToken}
                  href={`/ticket/${t.publicToken}`}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span>
                    {t.zoneName} · Seat {t.seatLabel}
                  </span>
                  <span className="text-muted-foreground">
                    {t.ticketNumber} →
                  </span>
                </Link>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {isExpired && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Reservation expired</CardTitle>
            <CardDescription>
              These seats were released. Please start a new order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className="underline">
              Back to event →
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Status: {order.status}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>
                {item.zoneName} × {item.quantity}
              </span>
              <span>{formatMoney(item.totalPriceMinor, order.currency)}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span className="text-lg font-bold text-rose">
              {formatMoney(order.totalMinor, order.currency)}
            </span>
          </div>

          {seats.length > 0 && (
            <div className="pt-2">
              <p className="mb-1 text-muted-foreground">Assigned seats</p>
              <div className="flex flex-wrap gap-2">
                {seats.map((seat) => (
                  <span
                    key={seat.id}
                    className="rounded border px-2 py-0.5 text-xs"
                  >
                    {seat.rowLabel}
                    {seat.seatNumber}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm">
        <p className="text-muted-foreground">
          Name: {order.customerName} · {order.customerEmail}
        </p>
      </div>
    </main>
  );
}
