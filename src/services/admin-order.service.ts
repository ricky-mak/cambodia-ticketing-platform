import { getDataSource, getRepo } from "@/lib/database";
import { Order } from "@/entities/order.entity";
import { OrderItem } from "@/entities/order-item.entity";
import { Payment } from "@/entities/payment.entity";
import { AuditAction, OrderStatus } from "@/types/enums";
import { writeAudit } from "./audit.service";
import { sendOrderConfirmation } from "./email.service";
import { logger } from "@/lib/logging";

export interface OrderListRow {
  id: string;
  orderNumber: string;
  publicToken: string;
  customerName: string;
  customerEmail: string;
  status: string;
  totalMinor: number;
  currency: string;
  seatCount: number;
  createdAt: string;
}

export async function searchOrders(params: {
  eventId: string;
  q?: string;
  status?: string;
  limit?: number;
}): Promise<OrderListRow[]> {
  const ds = await getDataSource();
  const like = params.q && params.q.trim() ? `%${params.q.trim()}%` : null;
  const status = params.status && params.status.trim() ? params.status : null;
  const rows: Array<{
    id: string;
    order_number: string;
    public_token: string;
    customer_name: string;
    customer_email: string;
    status: string;
    total_minor: number;
    currency: string;
    seat_count: number;
    created_at: Date;
  }> = await ds.query(
    `SELECT o.id, o.order_number, o.public_token, o.customer_name,
            o.customer_email, o.status, o.total_minor, o.currency, o.created_at,
            (SELECT count(*)::int FROM seats s WHERE s.order_id = o.id) AS seat_count
       FROM orders o
      WHERE o.event_id = $1
        AND ($2::text IS NULL OR o.status = $2)
        AND ($3::text IS NULL OR o.order_number ILIKE $3
             OR o.customer_name ILIKE $3 OR o.customer_email ILIKE $3
             OR o.customer_phone ILIKE $3)
      ORDER BY o.created_at DESC
      LIMIT $4`,
    [params.eventId, status, like, params.limit ?? 100],
  );
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    publicToken: r.public_token,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    status: r.status,
    totalMinor: r.total_minor,
    currency: r.currency,
    seatCount: r.seat_count,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export interface OrderSeatRow {
  seatLabel: string;
  seatStatus: string;
  ticketNumber: string | null;
  ticketStatus: string | null;
  ticketToken: string | null;
}

export async function getOrderDetail(orderId: string): Promise<{
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  seats: OrderSeatRow[];
} | null> {
  const order = await (await getRepo(Order)).findOne({ where: { id: orderId } });
  if (!order) return null;
  const items = await (await getRepo(OrderItem)).find({ where: { orderId } });
  const payments = await (await getRepo(Payment)).find({ where: { orderId } });

  const ds = await getDataSource();
  const seatRows: Array<{
    row_label: string;
    seat_number: number;
    seat_status: string;
    ticket_number: string | null;
    ticket_status: string | null;
    ticket_token: string | null;
  }> = await ds.query(
    `SELECT s.row_label, s.seat_number, s.status AS seat_status,
            t.ticket_number, t.status AS ticket_status, t.public_token AS ticket_token
       FROM seats s
       LEFT JOIN tickets t ON t.seat_id = s.id
      WHERE s.order_id = $1
      ORDER BY s.row_label, s.seat_number`,
    [orderId],
  );
  const seats: OrderSeatRow[] = seatRows.map((r) => ({
    seatLabel: `${r.row_label}${r.seat_number}`,
    seatStatus: r.seat_status,
    ticketNumber: r.ticket_number,
    ticketStatus: r.ticket_status,
    ticketToken: r.ticket_token,
  }));

  return { order, items, payments, seats };
}

/** Cancel an unpaid order and release its held seats. */
export async function cancelPendingOrder(
  orderId: string,
  staffUserId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const ds = await getDataSource();
  const result = await ds.transaction(async (m) => {
    const rows: Array<{ status: string }> = await m.query(
      `SELECT status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    );
    if (!rows[0]) return { ok: false, reason: "not_found" as const };
    if (rows[0].status !== OrderStatus.PENDING) {
      return { ok: false, reason: "not_pending" as const };
    }
    await m.query(
      `UPDATE seats SET status='AVAILABLE', order_id=NULL, order_item_id=NULL,
              held_until=NULL, updated_at=now()
        WHERE order_id=$1 AND status='HELD'`,
      [orderId],
    );
    await m.query(
      `UPDATE orders SET status='CANCELLED', cancelled_at=now(), updated_at=now()
        WHERE id=$1`,
      [orderId],
    );
    return { ok: true as const };
  });

  if (result.ok) {
    await writeAudit({
      staffUserId,
      action: AuditAction.ORDER_CANCELLED,
      entityType: "order",
      entityId: orderId,
    });
    logger.info("Order cancelled", { orderId, staffUserId });
  }
  return result;
}

/**
 * Record-only refund: mark the order/payment/tickets refunded and release the
 * seats for resale. The actual money movement is handled manually in the ABA
 * portal (see plan §8 — real PayWay refund can be wired later).
 */
export async function refundOrder(
  orderId: string,
  staffUserId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const ds = await getDataSource();
  const result = await ds.transaction(async (m) => {
    const rows: Array<{ status: string }> = await m.query(
      `SELECT status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    );
    if (!rows[0]) return { ok: false, reason: "not_found" as const };
    if (rows[0].status !== OrderStatus.PAID) {
      return { ok: false, reason: "not_paid" as const };
    }
    await m.query(
      `UPDATE tickets SET status='REFUNDED', updated_at=now()
        WHERE order_id=$1 AND status IN ('VALID','CHECKED_IN')`,
      [orderId],
    );
    await m.query(
      `UPDATE seats SET status='AVAILABLE', order_id=NULL, order_item_id=NULL,
              held_until=NULL, updated_at=now()
        WHERE order_id=$1`,
      [orderId],
    );
    await m.query(
      `UPDATE payments SET status='REFUNDED', updated_at=now()
        WHERE order_id=$1 AND status='SUCCESS'`,
      [orderId],
    );
    await m.query(
      `UPDATE orders SET status='REFUNDED', refunded_at=now(), updated_at=now()
        WHERE id=$1`,
      [orderId],
    );
    return { ok: true as const };
  });

  if (result.ok) {
    await writeAudit({
      staffUserId,
      action: AuditAction.ORDER_REFUNDED,
      entityType: "order",
      entityId: orderId,
      metadata: { mode: "record_only" },
    });
    logger.info("Order refunded (record-only)", { orderId, staffUserId });
  }
  return result;
}

/** Re-send the confirmation email for an order. */
export async function resendConfirmation(
  orderId: string,
  staffUserId: string,
): Promise<{ ok: boolean }> {
  try {
    await sendOrderConfirmation(orderId);
    await writeAudit({
      staffUserId,
      action: AuditAction.TICKET_EMAIL_RESENT,
      entityType: "order",
      entityId: orderId,
    });
    return { ok: true };
  } catch (error) {
    logger.error("Resend confirmation failed", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}
