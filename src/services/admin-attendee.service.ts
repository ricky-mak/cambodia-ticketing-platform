import { getDataSource } from "@/lib/database";
import { AuditAction } from "@/types/enums";
import { writeAudit } from "./audit.service";
import { resendConfirmation } from "./admin-order.service";
import { logger } from "@/lib/logging";

export interface AttendeeRow {
  ticketId: string;
  ticketNumber: string;
  publicToken: string;
  attendeeName: string;
  attendeeEmail: string;
  zoneName: string;
  seatLabel: string;
  status: string;
  orderNumber: string;
  checkedInAt: string | null;
}

export interface AttendeeFilters {
  eventId: string;
  q?: string;
  zoneId?: string;
  checkedIn?: "checked_in" | "not_checked_in";
  limit?: number;
}

async function queryAttendees(f: AttendeeFilters): Promise<AttendeeRow[]> {
  const ds = await getDataSource();
  const like = f.q && f.q.trim() ? `%${f.q.trim()}%` : null;
  const rows: Array<{
    id: string;
    ticket_number: string;
    public_token: string;
    attendee_name: string;
    attendee_email: string;
    zone_name: string;
    row_label: string;
    seat_number: number;
    status: string;
    order_number: string;
    checked_in_at: Date | null;
  }> = await ds.query(
    `SELECT t.id, t.ticket_number, t.public_token, t.attendee_name,
            t.attendee_email, z.name AS zone_name, s.row_label, s.seat_number,
            t.status, o.order_number, t.checked_in_at
       FROM tickets t
       JOIN seats s ON s.id = t.seat_id
       JOIN zones z ON z.id = t.zone_id
       JOIN orders o ON o.id = t.order_id
      WHERE t.event_id = $1
        AND ($2::uuid IS NULL OR t.zone_id = $2)
        AND ($3::text IS NULL OR (CASE
              WHEN $3 = 'checked_in' THEN t.status = 'CHECKED_IN'
              WHEN $3 = 'not_checked_in' THEN t.status = 'VALID'
              ELSE TRUE END))
        AND ($4::text IS NULL OR t.ticket_number ILIKE $4
             OR t.attendee_name ILIKE $4 OR t.attendee_email ILIKE $4
             OR o.order_number ILIKE $4)
      ORDER BY z.name, s.row_label, s.seat_number
      LIMIT $5`,
    [f.eventId, f.zoneId ?? null, f.checkedIn ?? null, like, f.limit ?? 500],
  );
  return rows.map((r) => ({
    ticketId: r.id,
    ticketNumber: r.ticket_number,
    publicToken: r.public_token,
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

export async function searchAttendees(
  f: AttendeeFilters,
): Promise<AttendeeRow[]> {
  return queryAttendees(f);
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function exportAttendeesCsv(f: AttendeeFilters): Promise<string> {
  const rows = await queryAttendees({ ...f, limit: 100_000 });
  const header = [
    "Ticket Number",
    "Attendee Name",
    "Email",
    "Zone",
    "Seat",
    "Status",
    "Order Number",
    "Checked In At",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.ticketNumber,
        r.attendeeName,
        r.attendeeEmail,
        r.zoneName,
        r.seatLabel,
        r.status,
        r.orderNumber,
        r.checkedInAt ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

/** Void a ticket (invalidate it) and release its seat for resale. */
export async function voidTicket(
  ticketId: string,
  staffUserId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const ds = await getDataSource();
  const result = await ds.transaction(async (m) => {
    const rows: Array<{ seat_id: string; status: string }> = await m.query(
      `SELECT seat_id, status FROM tickets WHERE id = $1 FOR UPDATE`,
      [ticketId],
    );
    if (!rows[0]) return { ok: false, reason: "not_found" as const };
    if (!["VALID", "CHECKED_IN"].includes(rows[0].status)) {
      return { ok: false, reason: "not_voidable" as const };
    }
    await m.query(
      `UPDATE tickets SET status='VOID', updated_at=now() WHERE id=$1`,
      [ticketId],
    );
    await m.query(
      `UPDATE seats SET status='AVAILABLE', order_id=NULL, order_item_id=NULL,
              held_until=NULL, updated_at=now() WHERE id=$1`,
      [rows[0].seat_id],
    );
    return { ok: true as const };
  });

  if (result.ok) {
    await writeAudit({
      staffUserId,
      action: AuditAction.TICKET_VOIDED,
      entityType: "ticket",
      entityId: ticketId,
    });
    logger.info("Ticket voided", { ticketId, staffUserId });
  }
  return result;
}

/** Resend the confirmation email for the order that owns this ticket. */
export async function resendTicketEmail(
  ticketId: string,
  staffUserId: string,
): Promise<{ ok: boolean }> {
  const ds = await getDataSource();
  const rows: Array<{ order_id: string }> = await ds.query(
    `SELECT order_id FROM tickets WHERE id = $1`,
    [ticketId],
  );
  if (!rows[0]) return { ok: false };
  return resendConfirmation(rows[0].order_id, staffUserId);
}
