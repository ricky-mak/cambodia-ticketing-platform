import { getDataSource } from "@/lib/database";

export interface DashboardMetrics {
  currency: string;
  ticketsSold: number;
  grossRevenueMinor: number;
  paidOrders: number;
  pendingOrders: number;
  failedPayments: number;
  totalSeats: number;
  soldSeats: number;
  heldSeats: number;
  availableSeats: number;
  totalAttendees: number;
  checkedIn: number;
  checkInPct: number;
}

/** Aggregate dashboard metrics for an event. */
export async function getDashboardMetrics(
  eventId: string,
  currency: string,
): Promise<DashboardMetrics> {
  const ds = await getDataSource();

  const one = async (sql: string): Promise<number> => {
    const rows: Array<{ n: number }> = await ds.query(sql, [eventId]);
    return Number(rows[0]?.n ?? 0);
  };

  const [
    grossRevenueMinor,
    paidOrders,
    pendingOrders,
    failedPayments,
    totalSeats,
    soldSeats,
    heldSeats,
    availableSeats,
    totalAttendees,
    checkedIn,
  ] = await Promise.all([
    one(`SELECT COALESCE(SUM(total_minor),0)::int AS n FROM orders WHERE event_id=$1 AND status='PAID'`),
    one(`SELECT count(*)::int AS n FROM orders WHERE event_id=$1 AND status='PAID'`),
    one(`SELECT count(*)::int AS n FROM orders WHERE event_id=$1 AND status='PENDING'`),
    one(`SELECT count(*)::int AS n FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.event_id=$1 AND p.status='FAILED'`),
    one(`SELECT count(*)::int AS n FROM seats WHERE event_id=$1`),
    one(`SELECT count(*)::int AS n FROM seats WHERE event_id=$1 AND status='SOLD'`),
    one(`SELECT count(*)::int AS n FROM seats WHERE event_id=$1 AND status='HELD'`),
    one(`SELECT count(*)::int AS n FROM seats WHERE event_id=$1 AND status='AVAILABLE'`),
    one(`SELECT count(*)::int AS n FROM tickets WHERE event_id=$1 AND status IN ('VALID','CHECKED_IN')`),
    one(`SELECT count(*)::int AS n FROM tickets WHERE event_id=$1 AND status='CHECKED_IN'`),
  ]);

  return {
    currency,
    ticketsSold: totalAttendees,
    grossRevenueMinor,
    paidOrders,
    pendingOrders,
    failedPayments,
    totalSeats,
    soldSeats,
    heldSeats,
    availableSeats,
    totalAttendees,
    checkedIn,
    checkInPct:
      totalAttendees > 0 ? Math.round((checkedIn / totalAttendees) * 100) : 0,
  };
}
