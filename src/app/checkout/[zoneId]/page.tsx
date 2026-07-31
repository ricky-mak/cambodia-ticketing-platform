import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckoutForm } from "@/components/checkout-form";
import { getZoneById, countAvailableSeats } from "@/services/zone.service";
import { getEventById } from "@/services/event.service";
import { isSalesOpen } from "@/lib/sales";
import { formatMoney } from "@/lib/money";
import { ZoneStatus } from "@/types/enums";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  const zone = await getZoneById(zoneId);
  if (!zone || zone.status !== ZoneStatus.ACTIVE) notFound();

  const event = await getEventById(zone.eventId);
  if (!event) notFound();

  const salesOpen = isSalesOpen(event);
  const available = await countAvailableSeats(zone.id);
  const maxQuantity = Math.min(zone.maxPerOrder, available);

  return (
    <main className="mx-auto max-w-md p-6 sm:p-10">
      <Link href="/" className="text-sm text-muted-foreground underline">
        ← Back to event
      </Link>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{zone.name}</CardTitle>
          <CardDescription>
            {formatMoney(zone.priceMinor, zone.currency)} per seat
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!salesOpen ? (
            <p className="text-sm text-muted-foreground">
              Ticket sales are not open for this event.
            </p>
          ) : available <= 0 ? (
            <p className="text-sm text-muted-foreground">
              This zone is sold out.
            </p>
          ) : (
            <CheckoutForm zoneId={zone.id} maxQuantity={maxQuantity} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
