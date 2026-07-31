import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * Append-only record of security-sensitive actions. staffUserId is nullable so
 * that failed logins (no known actor) and system actions can still be recorded.
 */
@Entity({ name: "audit_logs" })
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_audit_logs_staff_user_id")
  @Column({ name: "staff_user_id", type: "uuid", nullable: true })
  staffUserId!: string | null;

  @Index("idx_audit_logs_action")
  @Column({ type: "varchar", length: 64 })
  action!: string;

  @Column({ name: "entity_type", type: "varchar", length: 64, nullable: true })
  entityType!: string | null;

  @Column({ name: "entity_id", type: "varchar", length: 64, nullable: true })
  entityId!: string | null;

  @Column({ name: "previous_data", type: "jsonb", nullable: true })
  previousData!: Record<string, unknown> | null;

  @Column({ name: "new_data", type: "jsonb", nullable: true })
  newData!: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
