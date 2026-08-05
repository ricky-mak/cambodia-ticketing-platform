import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Payouts ledger (Phase F): records manual transfers of collected ticket
 * revenue to organizers, so the platform can reconcile outstanding balances.
 */
export class Payouts1754030000000 implements MigrationInterface {
  name = "Payouts1754030000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payouts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizer_id" uuid NOT NULL,
        "currency" varchar(3) NOT NULL,
        "amount_minor" integer NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'PAID',
        "note" text,
        "paid_at" timestamptz,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_payouts" PRIMARY KEY ("id"),
        CONSTRAINT "chk_payouts_status" CHECK ("status" IN ('PENDING', 'PAID'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_payouts_organizer_id" ON "payouts" ("organizer_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_payouts_organizer_id"`);
    await queryRunner.query(`DROP TABLE "payouts"`);
  }
}
