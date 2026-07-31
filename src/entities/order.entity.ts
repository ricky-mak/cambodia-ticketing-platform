import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { OrderStatus } from "@/types/enums";

@Entity({ name: "orders" })
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_orders_event_id")
  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @Index("uq_orders_order_number", { unique: true })
  @Column({ name: "order_number", type: "varchar", length: 32 })
  orderNumber!: string;

  // Random, unguessable token used in public URLs (never expose the id).
  @Index("uq_orders_public_token", { unique: true })
  @Column({ name: "public_token", type: "varchar", length: 64 })
  publicToken!: string;

  @Column({ name: "customer_name", type: "varchar", length: 255 })
  customerName!: string;

  @Column({ name: "customer_email", type: "varchar", length: 320 })
  customerEmail!: string;

  @Column({ name: "customer_phone", type: "varchar", length: 64 })
  customerPhone!: string;

  @Column({ type: "varchar", length: 3, default: "USD" })
  currency!: string;

  @Column({ name: "subtotal_minor", type: "integer" })
  subtotalMinor!: number;

  @Column({ name: "total_minor", type: "integer" })
  totalMinor!: number;

  @Index("idx_orders_status")
  @Column({ type: "varchar", length: 24, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Index("idx_orders_reservation_expires_at")
  @Column({ name: "reservation_expires_at", type: "timestamptz", nullable: true })
  reservationExpiresAt!: Date | null;

  @Column({ name: "paid_at", type: "timestamptz", nullable: true })
  paidAt!: Date | null;

  @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: "refunded_at", type: "timestamptz", nullable: true })
  refundedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
