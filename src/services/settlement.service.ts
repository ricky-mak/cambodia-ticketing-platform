import { getDataSource, getRepo } from "@/lib/database";
import { Payout } from "@/entities/payout.entity";
import { AuditAction, PayoutStatus } from "@/types/enums";
import { writeAudit } from "./audit.service";

/**
 * Settlement is computed per currency because an organizer may run events in
 * more than one currency (USD, KHR); summing across them would be meaningless.
 *
 * - collected  = sum of PAID order totals (money currently held for them)
 * - refunded   = sum of REFUNDED order totals (returned to buyers; informational)
 * - paidOut    = sum of PAID payouts we've already transferred
 * - outstanding = collected − paidOut (what we still owe)
 */
export interface SettlementRow {
  currency: string;
  collectedMinor: number;
  refundedMinor: number;
  paidOutMinor: number;
  outstandingMinor: number;
}

export async function getSettlementForOrganizer(
  organizerId: string,
): Promise<SettlementRow[]> {
  const ds = await getDataSource();
  const orderRows: Array<{
    currency: string;
    collected: string;
    refunded: string;
  }> = await ds.query(
    `SELECT currency,
            coalesce(sum(total_minor) FILTER (WHERE status = 'PAID'), 0)::bigint
              AS collected,
            coalesce(sum(total_minor) FILTER (WHERE status = 'REFUNDED'), 0)::bigint
              AS refunded
       FROM orders
      WHERE organizer_id = $1
      GROUP BY currency`,
    [organizerId],
  );
  const payoutRows: Array<{ currency: string; paid_out: string }> =
    await ds.query(
      `SELECT currency,
              coalesce(sum(amount_minor) FILTER (WHERE status = 'PAID'), 0)::bigint
                AS paid_out
         FROM payouts
        WHERE organizer_id = $1
        GROUP BY currency`,
      [organizerId],
    );

  const byCurrency = new Map<string, SettlementRow>();
  for (const r of orderRows) {
    byCurrency.set(r.currency, {
      currency: r.currency,
      collectedMinor: Number(r.collected),
      refundedMinor: Number(r.refunded),
      paidOutMinor: 0,
      outstandingMinor: Number(r.collected),
    });
  }
  for (const p of payoutRows) {
    const row =
      byCurrency.get(p.currency) ??
      {
        currency: p.currency,
        collectedMinor: 0,
        refundedMinor: 0,
        paidOutMinor: 0,
        outstandingMinor: 0,
      };
    row.paidOutMinor = Number(p.paid_out);
    row.outstandingMinor = row.collectedMinor - row.paidOutMinor;
    byCurrency.set(p.currency, row);
  }
  return [...byCurrency.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
}

export interface OrganizerSettlementSummary {
  organizerId: string;
  organizerName: string;
  status: string;
  rows: SettlementRow[];
}

/** Platform overview: settlement for every organizer. */
export async function listAllSettlements(): Promise<
  OrganizerSettlementSummary[]
> {
  const ds = await getDataSource();
  const organizers: Array<{ id: string; name: string; status: string }> =
    await ds.query(
      `SELECT id, name, status FROM organizers ORDER BY created_at ASC`,
    );
  const out: OrganizerSettlementSummary[] = [];
  for (const o of organizers) {
    out.push({
      organizerId: o.id,
      organizerName: o.name,
      status: o.status,
      rows: await getSettlementForOrganizer(o.id),
    });
  }
  return out;
}

export interface PayoutRow {
  id: string;
  currency: string;
  amountMinor: number;
  status: string;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
}

export async function listPayouts(organizerId: string): Promise<PayoutRow[]> {
  const repo = await getRepo(Payout);
  const payouts = await repo.find({
    where: { organizerId },
    order: { createdAt: "DESC" },
  });
  return payouts.map((p) => ({
    id: p.id,
    currency: p.currency,
    amountMinor: p.amountMinor,
    status: p.status,
    note: p.note,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  }));
}

/** Record a payout the platform has transferred to an organizer. */
export async function recordPayout(
  input: {
    organizerId: string;
    currency: string;
    amountMinor: number;
    note?: string | null;
  },
  actorId: string,
): Promise<{ ok: boolean; reason?: string; id?: string }> {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  const repo = await getRepo(Payout);
  const payout = repo.create({
    organizerId: input.organizerId,
    currency: input.currency.toUpperCase(),
    amountMinor: input.amountMinor,
    status: PayoutStatus.PAID,
    note: input.note?.trim() || null,
    paidAt: new Date(),
    createdBy: actorId,
  });
  await repo.save(payout);
  await writeAudit({
    staffUserId: actorId,
    action: AuditAction.PAYOUT_RECORDED,
    entityType: "payout",
    entityId: payout.id,
    newData: {
      organizerId: input.organizerId,
      currency: payout.currency,
      amountMinor: payout.amountMinor,
    },
  });
  return { ok: true, id: payout.id };
}
