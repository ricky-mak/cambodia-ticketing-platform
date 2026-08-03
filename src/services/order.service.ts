import type { EntityManager } from "typeorm";
import { getDataSource, getRepo } from "@/lib/database";
import { Order } from "@/entities/order.entity";
import { OrderItem } from "@/entities/order-item.entity";
import { Seat } from "@/entities/seat.entity";
import { Zone } from "@/entities/zone.entity";
import { Event } from "@/entities/event.entity";
import { OrderStatus, ZoneStatus } from "@/types/enums";
import { chooseContiguousSeats, type LockedSeat } from "@/lib/seat-allocation";
import { generateOrderNumber, generatePublicToken } from "@/lib/order-codes";
import { isSalesOpen } from "@/lib/sales";
import { multiplyMinor } from "@/lib/money";
import { scheduleOrderExpiration } from "./cloud-task.service";
import { logger } from "@/lib/logging";

export type ReservationErrorCode =
  | "SALES_CLOSED"
  | "ZONE_UNAVAILABLE"
  | "INVALID_QUANTITY"
  | "INSUFFICIENT_SEATS";

export class ReservationError extends Error {
  code: ReservationErrorCode;
  constructor(code: ReservationErrorCode, message: string) {
    super(message);
    this.name = "ReservationError";
    this.code = code;
  }
}

export interface CreateReservationInput {
  zoneId: string;
  quantity: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface ReservationResult {
  orderId: string;
  orderNumber: string;
  publicToken: string;
  seatLabels: string[];
  reservationExpiresAt: Date;
  totalMinor: number;
  currency: string;
  itemName: string;
}

// How many available seats to lock per checkout via FOR UPDATE SKIP LOCKED.
// Small enough that many buyers can hold different seats in the SAME zone at
// once — a large window makes one in-flight checkout lock most of a zone's
// available rows, so concurrent buyers falsely get "not enough seats" (worst on
// small/hot zones like VIP). But large enough to still find a contiguous run
// for the order. Previously a flat 1000. Tunable; validate under load test.
const SEAT_LOCK_MIN = 40;
const SEAT_LOCK_MAX = 200;

function seatLockLimit(quantity: number): number {
  return Math.min(Math.max(quantity * 4, SEAT_LOCK_MIN), SEAT_LOCK_MAX);
}

/** Release seats held by pending orders that have expired, for one event. */
async function releaseExpiredHoldsForEvent(
  manager: EntityManager,
  eventId: string,
): Promise<void> {
  await manager.query(
    `UPDATE seats
        SET status = 'AVAILABLE', order_id = NULL, order_item_id = NULL,
            held_until = NULL, updated_at = now()
      WHERE event_id = $1
        AND status = 'HELD'
        AND order_id IN (
          SELECT id FROM orders
           WHERE event_id = $1 AND status = 'PENDING'
             AND reservation_expires_at < now()
        )`,
    [eventId],
  );
  await manager.query(
    `UPDATE orders SET status = 'EXPIRED', updated_at = now()
      WHERE event_id = $1 AND status = 'PENDING'
        AND reservation_expires_at < now()`,
    [eventId],
  );
}

/**
 * Create a pending order and reserve seats for it, atomically. Prevents
 * overselling: candidate seats are locked with FOR UPDATE SKIP LOCKED so two
 * concurrent buyers can never be handed the same seat.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<ReservationResult> {
  const zone = await (await getRepo(Zone)).findOne({
    where: { id: input.zoneId },
  });
  if (!zone || zone.status !== ZoneStatus.ACTIVE) {
    throw new ReservationError("ZONE_UNAVAILABLE", "This zone is not available.");
  }

  const event = await (await getRepo(Event)).findOne({
    where: { id: zone.eventId },
  });
  if (!event || !isSalesOpen(event)) {
    throw new ReservationError("SALES_CLOSED", "Ticket sales are not open.");
  }

  const qty = Math.trunc(input.quantity);
  if (!Number.isFinite(qty) || qty < 1 || qty > zone.maxPerOrder) {
    throw new ReservationError(
      "INVALID_QUANTITY",
      `Please choose between 1 and ${zone.maxPerOrder} seats.`,
    );
  }

  const reservationMs = (event.reservationMinutes ?? 10) * 60_000;
  const ds = await getDataSource();

  const result = await ds.transaction(async (manager) => {
    // Reclaim any expired holds first so their seats become allocatable.
    await releaseExpiredHoldsForEvent(manager, event.id);

    const locked: LockedSeat[] = await manager.query(
      `SELECT id, row_label AS "rowLabel", seat_number AS "seatNumber"
         FROM seats
        WHERE zone_id = $1 AND status = 'AVAILABLE'
        ORDER BY row_label ASC, seat_number ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $2`,
      [zone.id, seatLockLimit(qty)],
    );

    const chosen = chooseContiguousSeats(locked, qty);
    if (!chosen) {
      throw new ReservationError(
        "INSUFFICIENT_SEATS",
        "Not enough seats are available right now. Try a smaller quantity or another zone.",
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + reservationMs);
    const unitPrice = zone.priceMinor;
    const totalPrice = multiplyMinor(unitPrice, qty);

    const orderRepo = manager.getRepository<Order>("Order");
    const order = orderRepo.create({
      eventId: event.id,
      orderNumber: generateOrderNumber(),
      publicToken: generatePublicToken(),
      customerName: input.customerName.trim(),
      customerEmail: input.customerEmail.trim().toLowerCase(),
      customerPhone: input.customerPhone.trim(),
      currency: zone.currency,
      subtotalMinor: totalPrice,
      totalMinor: totalPrice,
      status: OrderStatus.PENDING,
      reservationExpiresAt: expiresAt,
    });
    await orderRepo.save(order);

    const itemRepo = manager.getRepository<OrderItem>("OrderItem");
    const item = itemRepo.create({
      orderId: order.id,
      zoneId: zone.id,
      zoneName: zone.name,
      quantity: qty,
      unitPriceMinor: unitPrice,
      totalPriceMinor: totalPrice,
    });
    await itemRepo.save(item);

    const ids = chosen.map((s) => s.id);
    await manager.query(
      `UPDATE seats
          SET status = 'HELD', order_id = $1, order_item_id = $2,
              held_until = $3, updated_at = now()
        WHERE id = ANY($4::uuid[])`,
      [order.id, item.id, expiresAt, ids],
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      publicToken: order.publicToken,
      reservationExpiresAt: expiresAt,
      seatLabels: chosen.map((s) => `${s.rowLabel}${s.seatNumber}`),
      totalMinor: order.totalMinor,
      currency: order.currency,
      itemName: zone.name,
    } satisfies ReservationResult;
  });

  // Pass the order id — the Cloud Task expiry endpoint looks up the order by id.
  await scheduleOrderExpiration(result.orderId, result.reservationExpiresAt);
  logger.info("Order reserved", {
    orderNumber: result.orderNumber,
    zoneId: zone.id,
    quantity: qty,
  });

  return result;
}

export interface OrderView {
  order: Order;
  items: OrderItem[];
  seats: Seat[];
}

export async function getOrderByPublicToken(
  token: string,
): Promise<OrderView | null> {
  const order = await (await getRepo(Order)).findOne({
    where: { publicToken: token },
  });
  if (!order) return null;

  const items = await (await getRepo(OrderItem)).find({
    where: { orderId: order.id },
  });
  const seats = await (await getRepo(Seat)).find({
    where: { orderId: order.id },
    order: { rowLabel: "ASC", seatNumber: "ASC" },
  });

  return { order, items, seats };
}

export async function getOrderByNumber(
  orderNumber: string,
): Promise<Order | null> {
  return (await getRepo(Order)).findOne({ where: { orderNumber } });
}

/** Idempotent expiry of a single order (called by the Cloud Task in prod). */
export async function expireOrder(
  orderId: string,
): Promise<{ changed: boolean; reason?: string }> {
  const ds = await getDataSource();
  return ds.transaction(async (manager) => {
    const orderRepo = manager.getRepository<Order>("Order");
    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) return { changed: false, reason: "not_found" };
    if (order.status !== OrderStatus.PENDING) {
      return { changed: false, reason: "not_pending" };
    }
    if (
      order.reservationExpiresAt &&
      order.reservationExpiresAt.getTime() > Date.now()
    ) {
      return { changed: false, reason: "not_expired_yet" };
    }

    await manager.query(
      `UPDATE seats
          SET status = 'AVAILABLE', order_id = NULL, order_item_id = NULL,
              held_until = NULL, updated_at = now()
        WHERE order_id = $1 AND status = 'HELD'`,
      [orderId],
    );
    order.status = OrderStatus.EXPIRED;
    await orderRepo.save(order);
    return { changed: true };
  });
}

/** Fallback sweeper: expire all pending orders past their reservation window. */
export async function releaseExpiredHolds(): Promise<{ expiredOrders: number }> {
  const ds = await getDataSource();
  return ds.transaction(async (manager) => {
    await manager.query(
      `UPDATE seats
          SET status = 'AVAILABLE', order_id = NULL, order_item_id = NULL,
              held_until = NULL, updated_at = now()
        WHERE status = 'HELD'
          AND order_id IN (
            SELECT id FROM orders
             WHERE status = 'PENDING' AND reservation_expires_at < now()
          )`,
    );
    const expired = await manager.query(
      `UPDATE orders SET status = 'EXPIRED', updated_at = now()
        WHERE status = 'PENDING' AND reservation_expires_at < now()
        RETURNING id`,
    );
    return { expiredOrders: Array.isArray(expired) ? expired.length : 0 };
  });
}
