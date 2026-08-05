import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { PayoutStatus } from "@/types/enums";

/**
 * A recorded payout of collected ticket revenue to an organizer. Payouts are
 * made manually off-system (bank transfer in ABA); this row is the ledger the
 * platform keeps so it never double-pays and can reconcile what's outstanding.
 * Money is stored in minor units + currency, matching orders.
 */
@Entity({ name: "payouts" })
export class Payout {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_payouts_organizer_id")
  @Column({ name: "organizer_id", type: "uuid" })
  organizerId!: string;

  @Column({ type: "varchar", length: 3 })
  currency!: string;

  @Column({ name: "amount_minor", type: "integer" })
  amountMinor!: number;

  @Column({ type: "varchar", length: 16, default: PayoutStatus.PAID })
  status!: PayoutStatus;

  @Column({ type: "text", nullable: true })
  note!: string | null;

  @Column({ name: "paid_at", type: "timestamptz", nullable: true })
  paidAt!: Date | null;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
