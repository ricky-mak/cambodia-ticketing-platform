import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { StaffRole, StaffStatus } from "@/types/enums";

@Entity({ name: "staff_users" })
export class StaffUser {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  // Stored lower-cased; unique index enforces one account per email.
  @Index("uq_staff_users_email", { unique: true })
  @Column({ type: "varchar", length: 320 })
  email!: string;

  @Column({ name: "password_hash", type: "text" })
  passwordHash!: string;

  @Column({ type: "varchar", length: 32 })
  role!: StaffRole;

  @Column({ type: "varchar", length: 16, default: StaffStatus.ACTIVE })
  status!: StaffStatus;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
