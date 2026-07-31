import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getPrimaryEvent } from "@/services/event.service";
import { searchOrders } from "@/services/admin-order.service";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUSES } from "@/types/enums";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const event = await getPrimaryEvent();
  if (!event) {
    return <p className="text-muted-foreground">Create an event first.</p>;
  }
  const { q, status } = await searchParams;
  const orders = await searchOrders({ eventId: event.id, q, status });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Orders</h1>

      <form className="flex flex-wrap gap-2" method="get">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Order #, name, email, phone"
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{orders.length} order(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Seats</th>
                  <th className="py-2 pr-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link
                        className="font-medium underline"
                        href={`/admin/orders/${o.id}`}
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      {o.customerName}
                      <div className="text-xs text-muted-foreground">
                        {o.customerEmail}
                      </div>
                    </td>
                    <td className="py-2 pr-4">{o.status}</td>
                    <td className="py-2 pr-4">{o.seatCount}</td>
                    <td className="py-2 pr-4">
                      {formatMoney(o.totalMinor, o.currency)}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-muted-foreground">
                      No orders match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
