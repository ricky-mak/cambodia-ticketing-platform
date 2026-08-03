import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Supports the pending-order cap (abuse / inventory-lockup protection):
 * stores the buyer's IP on the order and indexes the columns the cap counts by.
 */
export class OrderClientIpAndCapIndexes1753990000000
  implements MigrationInterface
{
  name = "OrderClientIpAndCapIndexes1753990000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN "ip_address" varchar(64)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_customer_email" ON "orders" ("customer_email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_ip_address" ON "orders" ("ip_address")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_orders_ip_address"`);
    await queryRunner.query(`DROP INDEX "idx_orders_customer_email"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "ip_address"`);
  }
}
