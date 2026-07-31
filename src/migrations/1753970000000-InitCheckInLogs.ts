import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 7 schema: check-in activity log.
 */
export class InitCheckInLogs1753970000000 implements MigrationInterface {
  name = "InitCheckInLogs1753970000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "check_in_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticket_id" uuid,
        "staff_user_id" uuid,
        "action" varchar(32) NOT NULL,
        "device_info" text,
        "ip_address" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_check_in_logs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_check_in_logs_ticket" FOREIGN KEY ("ticket_id")
          REFERENCES "tickets" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_check_in_logs_staff" FOREIGN KEY ("staff_user_id")
          REFERENCES "staff_users" ("id") ON DELETE SET NULL,
        CONSTRAINT "chk_check_in_logs_action" CHECK ("action" IN
          ('CHECK_IN','UNDO_CHECK_IN','VALIDATION_FAILED','MANUAL_LOOKUP'))
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_check_in_logs_ticket_id" ON "check_in_logs" ("ticket_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_check_in_logs_staff_user_id" ON "check_in_logs" ("staff_user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_check_in_logs_created_at" ON "check_in_logs" ("created_at");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "check_in_logs";`);
  }
}
