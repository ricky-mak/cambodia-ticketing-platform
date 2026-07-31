import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateZoneForm } from "@/components/admin/create-zone-form";
import { getPrimaryEvent } from "@/services/event.service";
import { listZonesWithCounts } from "@/services/zone.service";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const event = await getPrimaryEvent();

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>No event yet</CardTitle>
            <CardDescription>
              Create the event before adding zones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="underline" href="/admin/event">
              Go to event settings →
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const zones = await listZonesWithCounts(event.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Zones & seats</h1>
        <p className="text-muted-foreground">
          Each zone has one price and a generated grid of numbered seats.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing zones</CardTitle>
          <CardDescription>Live seat counts.</CardDescription>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No zones yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Zone</th>
                    <th className="py-2 pr-4">Price</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Available</th>
                    <th className="py-2 pr-4">Held</th>
                    <th className="py-2 pr-4">Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map(({ zone, counts }) => (
                    <tr key={zone.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{zone.name}</td>
                      <td className="py-2 pr-4">
                        {formatMoney(zone.priceMinor, zone.currency)}
                      </td>
                      <td className="py-2 pr-4">{zone.status}</td>
                      <td className="py-2 pr-4">{counts.total.toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        {counts.available.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{counts.held.toLocaleString()}</td>
                      <td className="py-2 pr-4">{counts.sold.toLocaleString()}</td>
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
          <CardTitle>Add a zone</CardTitle>
          <CardDescription>
            Seats are generated immediately (rows × seats per row).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateZoneForm eventId={event.id} currency={event.currency} />
        </CardContent>
      </Card>
    </div>
  );
}
