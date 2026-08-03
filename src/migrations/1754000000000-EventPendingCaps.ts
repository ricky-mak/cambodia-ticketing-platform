import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Per-event configuration for the pending-order (inventory-lockup) caps.
 * Defaults match the previous hardcoded values.
 */
export class EventPendingCaps1754000000000 implements MigrationInterface {
  name = "EventPendingCaps1754000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "max_pending_per_email" integer NOT NULL DEFAULT 3`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "max_pending_per_ip" integer NOT NULL DEFAULT 20`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "max_pending_per_ip"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "max_pending_per_email"`,
    );
  }
}
