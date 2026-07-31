import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { PaymentStatus } from "@/types/enums";

/**
 * A payment attempt against an order. Kept provider-agnostic; PayWay-specific
 * data lives in raw_request / raw_callback. The unique (provider,
 * merchant_transaction_id) constraint is the idempotency anchor for callbacks.
 */
@Entity({ name: "payments" })
@Index("uq_payments_provider_merchant_txn", ["provider", "merchantTransactionId"], {
  unique: true,
})
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_payments_order_id")
  @Column({ name: "order_id", type: "uuid" })
  orderId!: string;

  @Column({ type: "varchar", length: 32 })
  provider!: string;

  @Column({ name: "merchant_transaction_id", type: "varchar", length: 64 })
  merchantTransactionId!: string;

  // Provider's own transaction reference (PayWay `apv`); unknown until settled.
  @Column({
    name: "provider_transaction_id",
    type: "varchar",
    length: 128,
    nullable: true,
  })
  providerTransactionId!: string | null;

  @Column({ name: "amount_minor", type: "integer" })
  amountMinor!: number;

  @Column({ type: "varchar", length: 3 })
  currency!: string;

  @Index("idx_payments_status")
  @Column({ type: "varchar", length: 24, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ name: "payment_method", type: "varchar", length: 32, nullable: true })
  paymentMethod!: string | null;

  @Column({ name: "raw_request", type: "jsonb", nullable: true })
  rawRequest!: Record<string, unknown> | null;

  @Column({ name: "raw_callback", type: "jsonb", nullable: true })
  rawCallback!: Record<string, unknown> | null;

  @Column({ name: "failure_reason", type: "text", nullable: true })
  failureReason!: string | null;

  @Column({ name: "paid_at", type: "timestamptz", nullable: true })
  paidAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
