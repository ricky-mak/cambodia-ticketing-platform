import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrderActions } from "@/components/admin/order-actions";
import { getOrderDetail } from "@/services/admin-order.service";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, items, payments, seats } = detail;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm underline">
          ← Orders
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {order.orderNumber}
        </h1>
        <p className="text-muted-foreground">Status: {order.status}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderActions orderId={order.id} status={order.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>{order.customerName}</p>
          <p className="text-muted-foreground">{order.customerEmail}</p>
          <p className="text-muted-foreground">{order.customerPhone}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            Total {formatMoney(order.totalMinor, order.currency)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between">
              <span>
                {it.zoneName} × {it.quantity}
              </span>
              <span>{formatMoney(it.totalPriceMinor, order.currency)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {payments.length === 0 && (
            <p className="text-muted-foreground">No payment records.</p>
          )}
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>
                {p.provider} · {p.merchantTransactionId}
              </span>
              <span>{p.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seats & tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-xs">
            {seats.map((s, i) => (
              <span key={i} className="rounded border px-2 py-1">
                {s.seatLabel} · {s.seatStatus}
                {s.ticketStatus ? ` · ${s.ticketStatus}` : ""}
                {s.ticketToken ? (
                  <>
                    {" "}
                    <Link className="underline" href={`/ticket/${s.ticketToken}`}>
                      view
                    </Link>
                  </>
                ) : null}
              </span>
            ))}
            {seats.length === 0 && (
              <span className="text-muted-foreground">No seats.</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
