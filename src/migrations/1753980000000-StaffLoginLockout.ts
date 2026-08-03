import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds per-account brute-force protection to staff logins: a failed-attempt
 * counter and a lockout timestamp.
 */
export class StaffLoginLockout1753980000000 implements MigrationInterface {
  name = "StaffLoginLockout1753980000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "staff_users" ADD COLUMN "failed_login_attempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_users" ADD COLUMN "locked_until" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "staff_users" DROP COLUMN "locked_until"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_users" DROP COLUMN "failed_login_attempts"`,
    );
  }
}
