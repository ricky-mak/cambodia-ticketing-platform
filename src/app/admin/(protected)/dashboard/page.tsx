import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin-context";
import { getDashboardMetrics } from "@/services/admin-stats.service";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  const event = ctx.activeEvent;

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>No event yet</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/admin/events" className="underline">
              Create your event to see metrics →
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const m = await getDashboardMetrics(event.id, event.currency);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>
        <p className="text-muted-foreground">Status: {event.status}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Gross revenue"
          value={formatMoney(m.grossRevenueMinor, m.currency)}
          hint={`${m.paidOrders} paid orders`}
        />
        <Metric label="Tickets sold" value={m.ticketsSold.toLocaleString()} />
        <Metric
          label="Checked in"
          value={`${m.checkedIn.toLocaleString()} (${m.checkInPct}%)`}
          hint={`of ${m.totalAttendees.toLocaleString()} attendees`}
        />
        <Metric
          label="Seats remaining"
          value={m.availableSeats.toLocaleString()}
          hint={`of ${m.totalSeats.toLocaleString()} total`}
        />
        <Metric label="Pending orders" value={m.pendingOrders.toLocaleString()} />
        <Metric label="Held seats" value={m.heldSeats.toLocaleString()} />
        <Metric label="Sold seats" value={m.soldSeats.toLocaleString()} />
        <Metric
          label="Failed payments"
          value={m.failedPayments.toLocaleString()}
        />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/orders" className="underline">
          Manage orders →
        </Link>
        <Link href="/admin/attendees" className="underline">
          Attendees →
        </Link>
      </div>
    </div>
  );
}
