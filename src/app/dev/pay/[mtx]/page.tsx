import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FakePayButtons } from "@/components/dev/fake-pay-buttons";
import { getOrderByNumber } from "@/services/order.service";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * Development-only stand-in for PayWay's hosted checkout, used by the fake
 * payment provider so the reserve → pay → confirm flow can be tested locally.
 */
export default async function FakePayPage({
  params,
}: {
  params: Promise<{ mtx: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { mtx } = await params;
  const order = await getOrderByNumber(decodeURIComponent(mtx));
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-sm p-6 sm:p-10">
      <Card>
        <CardHeader>
          <CardTitle>Simulated payment</CardTitle>
          <CardDescription>
            Dev sandbox — no real gateway. Order {order.orderNumber}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold">
            {formatMoney(order.totalMinor, order.currency)}
          </p>
          <FakePayButtons
            merchantTransactionId={order.orderNumber}
            publicToken={order.publicToken}
          />
        </CardContent>
      </Card>
    </main>
  );
}
