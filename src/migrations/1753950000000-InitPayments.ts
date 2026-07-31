import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 5 schema: payments. One row per payment attempt against an order.
 */
export class InitPayments1753950000000 implements MigrationInterface {
  name = "InitPayments1753950000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "provider" varchar(32) NOT NULL,
        "merchant_transaction_id" varchar(64) NOT NULL,
        "provider_transaction_id" varchar(128),
        "amount_minor" integer NOT NULL,
        "currency" varchar(3) NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'PENDING',
        "payment_method" varchar(32),
        "raw_request" jsonb,
        "raw_callback" jsonb,
        "failure_reason" text,
        "paid_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_payments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_payments_order" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_payments_status" CHECK ("status" IN
          ('PENDING','SUCCESS','FAILED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_payments_provider_merchant_txn"
         ON "payments" ("provider", "merchant_transaction_id");`,
    );
    // provider_transaction_id is unique per provider once known (nullable until then).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_payments_provider_provider_txn"
         ON "payments" ("provider", "provider_transaction_id")
        WHERE "provider_transaction_id" IS NOT NULL;`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_order_id" ON "payments" ("order_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_status" ON "payments" ("status");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payments";`);
  }
}
