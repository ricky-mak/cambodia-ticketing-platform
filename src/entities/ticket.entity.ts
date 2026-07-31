import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { TicketStatus } from "@/types/enums";

/**
 * One ticket per sold seat. The QR code encodes a signed token derived from
 * (id, eventId, qrTokenId); the database remains the source of truth for
 * validity at check-in. Public URLs use public_token, never the id.
 */
@Entity({ name: "tickets" })
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_tickets_event_id")
  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @Index("idx_tickets_order_id")
  @Column({ name: "order_id", type: "uuid" })
  orderId!: string;

  @Column({ name: "order_item_id", type: "uuid" })
  orderItemId!: string;

  @Column({ name: "zone_id", type: "uuid" })
  zoneId!: string;

  @Index("uq_tickets_seat_id", { unique: true })
  @Column({ name: "seat_id", type: "uuid" })
  seatId!: string;

  @Index("uq_tickets_ticket_number", { unique: true })
  @Column({ name: "ticket_number", type: "varchar", length: 32 })
  ticketNumber!: string;

  @Index("uq_tickets_public_token", { unique: true })
  @Column({ name: "public_token", type: "varchar", length: 64 })
  publicToken!: string;

  @Index("uq_tickets_qr_token_id", { unique: true })
  @Column({ name: "qr_token_id", type: "uuid" })
  qrTokenId!: string;

  @Column({ name: "attendee_name", type: "varchar", length: 255 })
  attendeeName!: string;

  @Column({ name: "attendee_email", type: "varchar", length: 320 })
  attendeeEmail!: string;

  @Index("idx_tickets_status")
  @Column({ type: "varchar", length: 16, default: TicketStatus.VALID })
  status!: TicketStatus;

  @Column({ name: "checked_in_at", type: "timestamptz", nullable: true })
  checkedInAt!: Date | null;

  @Column({ name: "checked_in_by", type: "uuid", nullable: true })
  checkedInBy!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
