import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 3 schema: events, priced zones, and individually numbered seats.
 * Requires PostgreSQL 13+ (gen_random_uuid()).
 */
export class InitEventZoneSeat1753930000000 implements MigrationInterface {
  name = "InitEventZoneSeat1753930000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "slug" varchar(255) NOT NULL,
        "description" text,
        "venue_name" varchar(255),
        "venue_address" text,
        "hero_image_url" text,
        "contact_email" varchar(320),
        "contact_phone" varchar(64),
        "refund_policy" text,
        "terms" text,
        "starts_at" timestamptz,
        "ends_at" timestamptz,
        "sales_start_at" timestamptz,
        "sales_end_at" timestamptz,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT',
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_events" PRIMARY KEY ("id"),
        CONSTRAINT "chk_events_status" CHECK
          ("status" IN ('DRAFT','PUBLISHED','SALES_CLOSED','COMPLETED','CANCELLED'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_events_slug" ON "events" ("slug");`,
    );

    await queryRunner.query(`
      CREATE TABLE "zones" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "price_minor" integer NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "total_seats" integer NOT NULL DEFAULT 0,
        "max_per_order" integer NOT NULL DEFAULT 10,
        "display_order" integer NOT NULL DEFAULT 0,
        "status" varchar(16) NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_zones" PRIMARY KEY ("id"),
        CONSTRAINT "fk_zones_event" FOREIGN KEY ("event_id")
          REFERENCES "events" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_zones_status" CHECK
          ("status" IN ('ACTIVE','HIDDEN','SOLD_OUT','DISABLED')),
        CONSTRAINT "chk_zones_price_nonneg" CHECK ("price_minor" >= 0)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_zones_event_id" ON "zones" ("event_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "seats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "zone_id" uuid NOT NULL,
        "row_label" varchar(16) NOT NULL,
        "seat_number" integer NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'AVAILABLE',
        "order_id" uuid,
        "held_until" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_seats" PRIMARY KEY ("id"),
        CONSTRAINT "fk_seats_event" FOREIGN KEY ("event_id")
          REFERENCES "events" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_seats_zone" FOREIGN KEY ("zone_id")
          REFERENCES "zones" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_seats_status" CHECK
          ("status" IN ('AVAILABLE','HELD','SOLD','BLOCKED'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_seats_zone_row_number" ON "seats" ("zone_id","row_label","seat_number");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_seats_zone_status_row_number" ON "seats" ("zone_id","status","row_label","seat_number");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_seats_order_id" ON "seats" ("order_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "seats";`);
    await queryRunner.query(`DROP TABLE "zones";`);
    await queryRunner.query(`DROP TABLE "events";`);
  }
}
