import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { OrganizerStatus } from "@/types/enums";

/**
 * A tenant: an organization that hosts events on the platform. Events, orders,
 * tickets and (organizer-scoped) staff belong to one organizer. Platform staff
 * have a NULL organizer_id (see StaffUser). Payouts to organizers are handled
 * manually off-system for now (see docs/multi-tenant-plan.md); payout_notes
 * holds the bank/account detail the operator transfers to.
 */
@Entity({ name: "organizers" })
export class Organizer {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Index("uq_organizers_slug", { unique: true })
  @Column({ type: "varchar", length: 255 })
  slug!: string;

  @Column({ type: "varchar", length: 16, default: OrganizerStatus.ACTIVE })
  status!: OrganizerStatus;

  @Column({ name: "contact_email", type: "varchar", length: 320, nullable: true })
  contactEmail!: string | null;

  // Free text: where/how the operator sends this organizer's manual payout.
  @Column({ name: "payout_notes", type: "text", nullable: true })
  payoutNotes!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
