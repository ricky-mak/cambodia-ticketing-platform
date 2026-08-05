import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin-context";
import {
  getSettlementForOrganizer,
  listAllSettlements,
  listPayouts,
  type SettlementRow,
} from "@/services/settlement.service";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

function SettlementTable({ rows }: { rows: SettlementRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No sales yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-4">Currency</th>
            <th className="py-2 pr-4">Collected</th>
            <th className="py-2 pr-4">Refunded</th>
            <th className="py-2 pr-4">Paid out</th>
            <th className="py-2 pr-4">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.currency} className="border-b last:border-0">
              <td className="py-2 pr-4 font-medium">{r.currency}</td>
              <td className="py-2 pr-4">
                {formatMoney(r.collectedMinor, r.currency)}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {formatMoney(r.refundedMinor, r.currency)}
              </td>
              <td className="py-2 pr-4">
                {formatMoney(r.paidOutMinor, r.currency)}
              </td>
              <td className="py-2 pr-4 font-bold text-rose">
                {formatMoney(r.outstandingMinor, r.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SettlementPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");

  // Platform admin: settlement across all organizers, each linking to record payouts.
  if (ctx.scope.isPlatform) {
    const all = await listAllSettlements();
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            Settlement
          </h1>
          <p className="text-muted-foreground">
            What each organizer is owed (collected minus payouts), per currency.
          </p>
        </div>
        {all.map((o) => (
          <Card key={o.organizerId}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {o.organizerName}
                {o.status !== "ACTIVE" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({o.status.toLowerCase()})
                  </span>
                )}
              </CardTitle>
              <Link
                href={`/admin/settlement/${o.organizerId}`}
                className="text-sm font-medium text-brand hover:underline"
              >
                Record payout →
              </Link>
            </CardHeader>
            <CardContent>
              <SettlementTable rows={o.rows} />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Organizer admin: their own settlement + payout history (read-only).
  const organizerId = ctx.scope.organizerId!;
  const [rows, payouts] = await Promise.all([
    getSettlementForOrganizer(organizerId),
    listPayouts(organizerId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight">
          Settlement
        </h1>
        <p className="text-muted-foreground">
          What you&apos;re owed, per currency. Payouts are transferred by the
          platform.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <SettlementTable rows={rows} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout history</CardTitle>
          <CardDescription>{payouts.length} payout(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {payouts.length === 0 ? (
            <p className="text-muted-foreground">No payouts yet.</p>
          ) : (
            payouts.map((p) => (
              <div key={p.id} className="flex justify-between border-b pb-2 last:border-0">
                <span>
                  {formatMoney(p.amountMinor, p.currency)}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : "—"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
