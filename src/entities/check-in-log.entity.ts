import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * Append-only log of check-in activity (successful check-ins, undos, failed
 * validations, manual lookups). ticket_id is nullable so a scan of an unknown
 * or forged token can still be recorded.
 */
@Entity({ name: "check_in_logs" })
export class CheckInLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_check_in_logs_ticket_id")
  @Column({ name: "ticket_id", type: "uuid", nullable: true })
  ticketId!: string | null;

  @Index("idx_check_in_logs_staff_user_id")
  @Column({ name: "staff_user_id", type: "uuid", nullable: true })
  staffUserId!: string | null;

  @Column({ type: "varchar", length: 32 })
  action!: string;

  @Column({ name: "device_info", type: "text", nullable: true })
  deviceInfo!: string | null;

  @Column({ name: "ip_address", type: "varchar", length: 64, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
