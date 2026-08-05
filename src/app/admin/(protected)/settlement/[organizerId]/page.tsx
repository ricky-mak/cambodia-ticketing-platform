import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPlatformAdmin } from "@/lib/api-auth";
import { getOrganizerById } from "@/services/organizer.service";
import {
  getSettlementForOrganizer,
  listPayouts,
} from "@/services/settlement.service";
import { RecordPayoutForm } from "@/components/admin/record-payout-form";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function OrganizerSettlementPage({
  params,
}: {
  params: Promise<{ organizerId: string }>;
}) {
  const staff = await getPlatformAdmin();
  if (!staff) redirect("/admin/settlement");

  const { organizerId } = await params;
  const organizer = await getOrganizerById(organizerId);
  if (!organizer) notFound();

  const [rows, payouts] = await Promise.all([
    getSettlementForOrganizer(organizerId),
    listPayouts(organizerId),
  ]);
  const currencies = rows.map((r) => r.currency);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/settlement"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All settlements
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight">
          {organizer.name}
        </h1>
        {organizer.payoutNotes && (
          <p className="text-sm text-muted-foreground">
            Payout: {organizer.payoutNotes}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Currency</th>
                    <th className="py-2 pr-4">Collected</th>
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record a payout</CardTitle>
          <CardDescription>
            Log a transfer you&apos;ve made to this organizer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecordPayoutForm organizerId={organizerId} currencies={currencies} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {payouts.length === 0 ? (
            <p className="text-muted-foreground">No payouts yet.</p>
          ) : (
            payouts.map((p) => (
              <div
                key={p.id}
                className="flex justify-between border-b pb-2 last:border-0"
              >
                <span>
                  {formatMoney(p.amountMinor, p.currency)}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {p.paidAt
                    ? new Date(p.paidAt).toISOString().slice(0, 10)
                    : "—"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
