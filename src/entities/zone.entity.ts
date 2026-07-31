import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ZoneStatus } from "@/types/enums";

/**
 * A priced seating zone within an event. One price per zone. The zone is the
 * sellable unit: customers pick a zone and a quantity, and the system
 * auto-assigns available seats. Seat rows live in the `seats` table; a zone's
 * live availability is derived from seat statuses, not stored here.
 */
@Entity({ name: "zones" })
export class Zone {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_zones_event_id")
  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "price_minor", type: "integer" })
  priceMinor!: number;

  @Column({ type: "varchar", length: 3, default: "USD" })
  currency!: string;

  // Total seats generated for the zone (rows x seatsPerRow).
  @Column({ name: "total_seats", type: "integer", default: 0 })
  totalSeats!: number;

  @Column({ name: "max_per_order", type: "integer", default: 10 })
  maxPerOrder!: number;

  @Column({ name: "display_order", type: "integer", default: 0 })
  displayOrder!: number;

  @Column({ type: "varchar", length: 16, default: ZoneStatus.ACTIVE })
  status!: ZoneStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
