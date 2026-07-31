import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 4 schema: orders + order items, seat linkage to orders, and a
 * configurable reservation window on events.
 */
export class InitOrders1753940000000 implements MigrationInterface {
  name = "InitOrders1753940000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "reservation_minutes" integer NOT NULL DEFAULT 10;`,
    );

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "order_number" varchar(32) NOT NULL,
        "public_token" varchar(64) NOT NULL,
        "customer_name" varchar(255) NOT NULL,
        "customer_email" varchar(320) NOT NULL,
        "customer_phone" varchar(64) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "subtotal_minor" integer NOT NULL,
        "total_minor" integer NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'PENDING',
        "reservation_expires_at" timestamptz,
        "paid_at" timestamptz,
        "cancelled_at" timestamptz,
        "refunded_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_orders" PRIMARY KEY ("id"),
        CONSTRAINT "fk_orders_event" FOREIGN KEY ("event_id")
          REFERENCES "events" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_orders_status" CHECK ("status" IN
          ('PENDING','PAYMENT_PROCESSING','PAID','EXPIRED','CANCELLED',
           'PARTIALLY_REFUNDED','REFUNDED','PAYMENT_FAILED'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_orders_order_number" ON "orders" ("order_number");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_orders_public_token" ON "orders" ("public_token");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_event_id" ON "orders" ("event_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_status" ON "orders" ("status");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_reservation_expires_at" ON "orders" ("reservation_expires_at");`,
    );

    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "zone_id" uuid NOT NULL,
        "zone_name" varchar(255) NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price_minor" integer NOT NULL,
        "total_price_minor" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "fk_order_items_order" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_order_items_zone" FOREIGN KEY ("zone_id")
          REFERENCES "zones" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_order_items_order_id" ON "order_items" ("order_id");`,
    );

    // Link seats to the owning order / order item.
    await queryRunner.query(
      `ALTER TABLE "seats" ADD COLUMN "order_item_id" uuid;`,
    );
    await queryRunner.query(`
      ALTER TABLE "seats" ADD CONSTRAINT "fk_seats_order"
        FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "seats" ADD CONSTRAINT "fk_seats_order_item"
        FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seats" DROP CONSTRAINT "fk_seats_order_item";`,
    );
    await queryRunner.query(
      `ALTER TABLE "seats" DROP CONSTRAINT "fk_seats_order";`,
    );
    await queryRunner.query(`ALTER TABLE "seats" DROP COLUMN "order_item_id";`);
    await queryRunner.query(`DROP TABLE "order_items";`);
    await queryRunner.query(`DROP TABLE "orders";`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "reservation_minutes";`,
    );
  }
}
