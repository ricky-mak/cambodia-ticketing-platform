import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * A server-side login session.
 *
 * The raw session token lives only in the user's HttpOnly cookie. We store the
 * SHA-256 hash of it here, so a database leak does not expose usable tokens.
 * Sessions are revocable (revokedAt) which is what lets us log a staff member
 * out immediately when their account is disabled.
 */
@Entity({ name: "sessions" })
export class Session {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("uq_sessions_token_hash", { unique: true })
  @Column({ name: "token_hash", type: "varchar", length: 64 })
  tokenHash!: string;

  @Index("idx_sessions_staff_user_id")
  @Column({ name: "staff_user_id", type: "uuid" })
  staffUserId!: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt!: Date | null;

  @Column({ name: "last_used_at", type: "timestamptz", nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent!: string | null;

  @Column({ name: "ip_address", type: "varchar", length: 64, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
