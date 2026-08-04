import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { EventStatus } from "@/types/enums";

@Entity({ name: "events" })
export class Event {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Owning tenant. Every event belongs to one organizer.
  @Index("idx_events_organizer_id")
  @Column({ name: "organizer_id", type: "uuid" })
  organizerId!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Index("uq_events_slug", { unique: true })
  @Column({ type: "varchar", length: 255 })
  slug!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "venue_name", type: "varchar", length: 255, nullable: true })
  venueName!: string | null;

  @Column({ name: "venue_address", type: "text", nullable: true })
  venueAddress!: string | null;

  @Column({ name: "hero_image_url", type: "text", nullable: true })
  heroImageUrl!: string | null;

  @Column({ name: "contact_email", type: "varchar", length: 320, nullable: true })
  contactEmail!: string | null;

  @Column({ name: "contact_phone", type: "varchar", length: 64, nullable: true })
  contactPhone!: string | null;

  @Column({ name: "refund_policy", type: "text", nullable: true })
  refundPolicy!: string | null;

  @Column({ name: "terms", type: "text", nullable: true })
  terms!: string | null;

  @Column({ name: "starts_at", type: "timestamptz", nullable: true })
  startsAt!: Date | null;

  @Column({ name: "ends_at", type: "timestamptz", nullable: true })
  endsAt!: Date | null;

  @Column({ name: "sales_start_at", type: "timestamptz", nullable: true })
  salesStartAt!: Date | null;

  @Column({ name: "sales_end_at", type: "timestamptz", nullable: true })
  salesEndAt!: Date | null;

  @Column({ type: "varchar", length: 16, default: EventStatus.DRAFT })
  status!: EventStatus;

  // ISO 4217 code, e.g. "USD" or "KHR".
  @Column({ type: "varchar", length: 3, default: "USD" })
  currency!: string;

  // How long seats stay reserved for a pending order, in minutes.
  @Column({ name: "reservation_minutes", type: "integer", default: 10 })
  reservationMinutes!: number;

  // Inventory-lockup caps: max concurrent active unpaid orders per email / IP.
  @Column({ name: "max_pending_per_email", type: "integer", default: 3 })
  maxPendingPerEmail!: number;

  @Column({ name: "max_pending_per_ip", type: "integer", default: 20 })
  maxPendingPerIp!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
