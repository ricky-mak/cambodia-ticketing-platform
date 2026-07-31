import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { SeatStatus } from "@/types/enums";

/**
 * An individual, numbered seat. Seats are the source of truth for inventory.
 * Allocation (Phase 4) locks specific seat rows with FOR UPDATE SKIP LOCKED and
 * prefers contiguous seats (same row_label, consecutive seat_number).
 */
@Entity({ name: "seats" })
@Index("uq_seats_zone_row_number", ["zoneId", "rowLabel", "seatNumber"], {
  unique: true,
})
// Drives both availability counts and the allocation scan order.
@Index("idx_seats_zone_status_row_number", [
  "zoneId",
  "status",
  "rowLabel",
  "seatNumber",
])
export class Seat {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @Column({ name: "zone_id", type: "uuid" })
  zoneId!: string;

  @Column({ name: "row_label", type: "varchar", length: 16 })
  rowLabel!: string;

  @Column({ name: "seat_number", type: "integer" })
  seatNumber!: number;

  @Column({ type: "varchar", length: 16, default: SeatStatus.AVAILABLE })
  status!: SeatStatus;

  // Set when the seat is held/sold (FK to orders / order_items).
  @Index("idx_seats_order_id")
  @Column({ name: "order_id", type: "uuid", nullable: true })
  orderId!: string | null;

  @Column({ name: "order_item_id", type: "uuid", nullable: true })
  orderItemId!: string | null;

  // Redundant with the owning order's expiry; helps the fallback sweeper.
  @Column({ name: "held_until", type: "timestamptz", nullable: true })
  heldUntil!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
