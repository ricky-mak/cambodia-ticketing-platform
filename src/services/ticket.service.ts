import type { EntityManager } from "typeorm";
import { getDataSource, getRepo } from "@/lib/database";
import { Ticket } from "@/entities/ticket.entity";
import { Event } from "@/entities/event.entity";
import { Zone } from "@/entities/zone.entity";
import { Seat } from "@/entities/seat.entity";
import { generateTicketNumber, generatePublicToken } from "@/lib/order-codes";

/**
 * Create one VALID ticket per SOLD seat of an order. Runs inside the payment
 * confirmation transaction (same manager). Idempotent: if tickets already
 * exist for the order it does nothing.
 */
export async function createTicketsForPaidOrder(
  manager: EntityManager,
  orderId: string,
): Promise<void> {
  const existing: Array<{ c: number }> = await manager.query(
    `SELECT count(*)::int AS c FROM tickets WHERE order_id = $1`,
    [orderId],
  );
  if ((existing[0]?.c ?? 0) > 0) return;

  const orderRows: Array<{
    event_id: string;
    customer_name: string;
    customer_email: string;
  }> = await manager.query(
    `SELECT event_id, customer_name, customer_email FROM orders WHERE id = $1`,
    [orderId],
  );
  const order = orderRows[0];
  if (!order) return;

  const seats: Array<{ id: string; zone_id: string; order_item_id: string }> =
    await manager.query(
      `SELECT id, zone_id, order_item_id FROM seats
        WHERE order_id = $1 AND status = 'SOLD'
        ORDER BY row_label, seat_number`,
      [orderId],
    );

  for (const seat of seats) {
    await manager.query(
      `INSERT INTO tickets
         (id, event_id, order_id, order_item_id, zone_id, seat_id,
          ticket_number, public_token, qr_token_id, attendee_name,
          attendee_email, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
               gen_random_uuid(), $8, $9, 'VALID', now(), now())`,
      [
        order.event_id,
        orderId,
        seat.order_item_id,
        seat.zone_id,
        seat.id,
        generateTicketNumber(),
        generatePublicToken(),
        order.customer_name,
        order.customer_email,
      ],
    );
  }
}

export interface TicketView {
  ticket: Ticket;
  event: Event;
  zone: Zone;
  seat: Seat;
}

export async function getTicketByPublicToken(
  token: string,
): Promise<TicketView | null> {
  const ticket = await (await getRepo(Ticket)).findOne({
    where: { publicToken: token },
  });
  if (!ticket) return null;

  const event = await (await getRepo(Event)).findOne({
    where: { id: ticket.eventId },
  });
  const zone = await (await getRepo(Zone)).findOne({
    where: { id: ticket.zoneId },
  });
  const seat = await (await getRepo(Seat)).findOne({
    where: { id: ticket.seatId },
  });
  if (!event || !zone || !seat) return null;

  return { ticket, event, zone, seat };
}

export interface OrderTicketSummary {
  publicToken: string;
  ticketNumber: string;
  seatLabel: string;
  zoneName: string;
}

/** Ticket summaries for an order, for the confirmation email. */
export async function getTicketSummariesForOrder(
  orderId: string,
): Promise<OrderTicketSummary[]> {
  const ds = await getDataSource();
  const rows: Array<{
    public_token: string;
    ticket_number: string;
    row_label: string;
    seat_number: number;
    zone_name: string;
  }> = await ds.query(
    `SELECT t.public_token, t.ticket_number, s.row_label, s.seat_number, z.name AS zone_name
       FROM tickets t
       JOIN seats s ON s.id = t.seat_id
       JOIN zones z ON z.id = t.zone_id
      WHERE t.order_id = $1
      ORDER BY z.name, s.row_label, s.seat_number`,
    [orderId],
  );
  return rows.map((r) => ({
    publicToken: r.public_token,
    ticketNumber: r.ticket_number,
    seatLabel: `${r.row_label}${r.seat_number}`,
    zoneName: r.zone_name,
  }));
}
