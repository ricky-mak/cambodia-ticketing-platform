import type { DataSource, EntityManager } from "typeorm";
import { getDataSource } from "@/lib/database";

// Something that can run raw SQL — a DataSource or a transaction's EntityManager.
type Executor = DataSource | EntityManager;
import { Ticket } from "@/entities/ticket.entity";
import { verifyTicketToken } from "@/lib/qr-signing";
import { CheckInAction, TicketStatus } from "@/types/enums";

export type CheckOutcome =
  | "VALID" // valid, ready to check in (validate only)
  | "CHECKED_IN" // just checked in successfully
  | "ALREADY_CHECKED_IN"
  | "TICKET_NOT_FOUND"
  | "INVALID_SIGNATURE"
  | "WRONG_EVENT"
  | "CANCELLED"
  | "REFUNDED"
  | "VOID";

export interface TicketDisplay {
  ticketId: string;
  ticketNumber: string;
  attendeeName: string;
  zoneName: string;
  seatLabel: string;
  status: string;
  checkedInAt: string | null;
}

export interface CheckResult {
  outcome: CheckOutcome;
  ticket?: TicketDisplay;
}

export interface CheckInContext {
  deviceInfo?: string | null;
  ipAddress?: string | null;
}

interface DisplayRow {
  id: string;
  ticket_number: string;
  attendee_name: string;
  status: string;
  checked_in_at: Date | null;
  event_id: string;
  qr_token_id: string;
  zone_name: string;
  row_label: string;
  seat_number: number;
}

async function fetchTicketDisplay(
  exec: Executor,
  ticketId: string,
): Promise<DisplayRow | null> {
  const rows: DisplayRow[] = await exec.query(
    `SELECT t.id, t.ticket_number, t.attendee_name, t.status, t.checked_in_at,
            t.event_id, t.qr_token_id, z.name AS zone_name,
            s.row_label, s.seat_number
       FROM tickets t
       JOIN zones z ON z.id = t.zone_id
       JOIN seats s ON s.id = t.seat_id
      WHERE t.id = $1`,
    [ticketId],
  );
  return rows[0] ?? null;
}

function toDisplay(row: DisplayRow): TicketDisplay {
  return {
    ticketId: row.id,
    ticketNumber: row.ticket_number,
    attendeeName: row.attendee_name,
    zoneName: row.zone_name,
    seatLabel: `${row.row_label}${row.seat_number}`,
    status: row.status,
    checkedInAt: row.checked_in_at
      ? new Date(row.checked_in_at).toISOString()
      : null,
  };
}

function statusToOutcome(status: string): CheckOutcome {
  switch (status) {
    case TicketStatus.VALID:
      return "VALID";
    case TicketStatus.CHECKED_IN:
      return "ALREADY_CHECKED_IN";
    case TicketStatus.CANCELLED:
      return "CANCELLED";
    case TicketStatus.REFUNDED:
      return "REFUNDED";
    default:
      return "VOID";
  }
}

async function writeCheckInLog(
  exec: Executor,
  action: CheckInAction,
  ticketId: string | null,
  staffUserId: string | null,
  ctx: CheckInContext,
): Promise<void> {
  await exec.query(
    `INSERT INTO check_in_logs
       (id, ticket_id, staff_user_id, action, device_info, ip_address, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`,
    [ticketId, staffUserId, action, ctx.deviceInfo ?? null, ctx.ipAddress ?? null],
  );
}

/** Read-only validation of a scanned token (does not check in). */
export async function validateToken(token: string): Promise<CheckResult> {
  const payload = verifyTicketToken(token);
  if (!payload) return { outcome: "INVALID_SIGNATURE" };

  const ds = await getDataSource();
  const row = await fetchTicketDisplay(ds, payload.ticketId);
  if (!row) return { outcome: "TICKET_NOT_FOUND" };
  if (row.qr_token_id !== payload.tokenId) return { outcome: "INVALID_SIGNATURE" };
  if (row.event_id !== payload.eventId) {
    return { outcome: "WRONG_EVENT", ticket: toDisplay(row) };
  }
  return { outcome: statusToOutcome(row.status), ticket: toDisplay(row) };
}

/** Atomic check-in by ticket id: succeeds only if the ticket is currently VALID. */
async function performCheckIn(
  ds: DataSource,
  ticketId: string,
  staffUserId: string,
  ctx: CheckInContext,
): Promise<CheckResult> {
  // The ticket UPDATE and its audit-log row are written in ONE transaction, so
  // an admitted ticket always has a matching CHECK_IN log (and a failed attempt
  // its VALIDATION_FAILED log). A log-insert failure rolls back the admission —
  // the intended consistency guarantee.
  return ds.transaction(async (manager: EntityManager) => {
    // Use UpdateResult.affected (reliable rowCount) rather than the shape of a
    // raw RETURNING result, which TypeORM does not expose consistently.
    const result = await manager.getRepository<Ticket>("Ticket").update(
      { id: ticketId, status: TicketStatus.VALID },
      {
        status: TicketStatus.CHECKED_IN,
        checkedInAt: new Date(),
        checkedInBy: staffUserId,
      },
    );

    const row = await fetchTicketDisplay(manager, ticketId);

    if (result.affected === 1) {
      await writeCheckInLog(
        manager,
        CheckInAction.CHECK_IN,
        ticketId,
        staffUserId,
        ctx,
      );
      return { outcome: "CHECKED_IN", ticket: row ? toDisplay(row) : undefined };
    }

    await writeCheckInLog(
      manager,
      CheckInAction.VALIDATION_FAILED,
      row?.id ?? null,
      staffUserId,
      ctx,
    );
    if (!row) return { outcome: "TICKET_NOT_FOUND" };
    return { outcome: statusToOutcome(row.status), ticket: toDisplay(row) };
  });
}

/** Check in from a scanned QR token. */
export async function checkInByToken(
  token: string,
  staffUserId: string,
  ctx: CheckInContext,
): Promise<CheckResult> {
  const ds = await getDataSource();
  const payload = verifyTicketToken(token);
  if (!payload) {
    await writeCheckInLog(
      ds,
      CheckInAction.VALIDATION_FAILED,
      null,
      staffUserId,
      ctx,
    );
    return { outcome: "INVALID_SIGNATURE" };
  }

  const row = await fetchTicketDisplay(ds, payload.ticketId);
  if (!row) {
    await writeCheckInLog(
      ds,
      CheckInAction.VALIDATION_FAILED,
      null,
      staffUserId,
      ctx,
    );
    return { outcome: "TICKET_NOT_FOUND" };
  }
  if (row.qr_token_id !== payload.tokenId || row.event_id !== payload.eventId) {
    await writeCheckInLog(
      ds,
      CheckInAction.VALIDATION_FAILED,
      row.id,
      staffUserId,
      ctx,
    );
    const outcome: CheckOutcome =
      row.event_id !== payload.eventId ? "WRONG_EVENT" : "INVALID_SIGNATURE";
    return { outcome, ticket: toDisplay(row) };
  }

  return performCheckIn(ds, payload.ticketId, staffUserId, ctx);
}

/** Manual check-in by ticket id (from the search screen). */
export async function checkInByTicketId(
  ticketId: string,
  staffUserId: string,
  ctx: CheckInContext,
): Promise<CheckResult> {
  const ds = await getDataSource();
  return performCheckIn(ds, ticketId, staffUserId, ctx);
}

/** Undo a check-in (authorized roles only — enforced at the API layer). */
export async function undoCheckIn(
  ticketId: string,
  staffUserId: string,
  ctx: CheckInContext,
): Promise<{ ok: boolean }> {
  const ds = await getDataSource();
  // Revert and log atomically, mirroring performCheckIn.
  return ds.transaction(async (manager: EntityManager) => {
    const result = await manager.getRepository<Ticket>("Ticket").update(
      { id: ticketId, status: TicketStatus.CHECKED_IN },
      { status: TicketStatus.VALID, checkedInAt: null, checkedInBy: null },
    );
    if (result.affected === 1) {
      await writeCheckInLog(
        manager,
        CheckInAction.UNDO_CHECK_IN,
        ticketId,
        staffUserId,
        ctx,
      );
      return { ok: true };
    }
    return { ok: false };
  });
}

export interface SearchRow {
  ticketId: string;
  ticketNumber: string;
  attendeeName: string;
  attendeeEmail: string;
  zoneName: string;
  seatLabel: string;
  status: string;
  orderNumber: string;
  checkedInAt: string | null;
}

export async function searchTickets(query: string): Promise<SearchRow[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const ds = await getDataSource();
  // Leading-wildcard ILIKE is served by the GIN pg_trgm indexes on
  // tickets.(attendee_name, attendee_email, ticket_number) and
  // orders.order_number (migration SearchTrigramIndexes), so this stays fast
  // at ~60k tickets even under concurrent event-day searches.
  const like = `%${trimmed}%`;
  const rows: Array<{
    id: string;
    ticket_number: string;
    attendee_name: string;
    attendee_email: string;
    zone_name: string;
    row_label: string;
    seat_number: number;
    status: string;
    order_number: string;
    checked_in_at: Date | null;
  }> = await ds.query(
    `SELECT t.id, t.ticket_number, t.attendee_name, t.attendee_email,
            z.name AS zone_name, s.row_label, s.seat_number, t.status,
            o.order_number, t.checked_in_at
       FROM tickets t
       JOIN zones z ON z.id = t.zone_id
       JOIN seats s ON s.id = t.seat_id
       JOIN orders o ON o.id = t.order_id
      WHERE t.ticket_number ILIKE $1
         OR t.attendee_name ILIKE $1
         OR t.attendee_email ILIKE $1
         OR o.order_number ILIKE $1
      ORDER BY t.attendee_name
      LIMIT 25`,
    [like],
  );
  return rows.map((r) => ({
    ticketId: r.id,
    ticketNumber: r.ticket_number,
    attendeeName: r.attendee_name,
    attendeeEmail: r.attendee_email,
    zoneName: r.zone_name,
    seatLabel: `${r.row_label}${r.seat_number}`,
    status: r.status,
    orderNumber: r.order_number,
    checkedInAt: r.checked_in_at
      ? new Date(r.checked_in_at).toISOString()
      : null,
  }));
}

export interface ActivityRow {
  action: string;
  createdAt: string;
  attendeeName: string | null;
  ticketNumber: string | null;
  seatLabel: string | null;
  staffName: string | null;
}

export async function getRecentActivity(limit = 50): Promise<ActivityRow[]> {
  const ds = await getDataSource();
  const rows: Array<{
    action: string;
    created_at: Date;
    attendee_name: string | null;
    ticket_number: string | null;
    row_label: string | null;
    seat_number: number | null;
    staff_name: string | null;
  }> = await ds.query(
    `SELECT l.action, l.created_at, t.ticket_number, t.attendee_name,
            z.name AS zone_name, s.row_label, s.seat_number, u.name AS staff_name
       FROM check_in_logs l
       LEFT JOIN tickets t ON t.id = l.ticket_id
       LEFT JOIN zones z ON z.id = t.zone_id
       LEFT JOIN seats s ON s.id = t.seat_id
       LEFT JOIN staff_users u ON u.id = l.staff_user_id
      ORDER BY l.created_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    action: r.action,
    createdAt: new Date(r.created_at).toISOString(),
    attendeeName: r.attendee_name,
    ticketNumber: r.ticket_number,
    seatLabel:
      r.row_label && r.seat_number != null
        ? `${r.row_label}${r.seat_number}`
        : null,
    staffName: r.staff_name,
  }));
}
