import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Multi-tenant foundation (Phase A). Introduces the Organizer tenant and tags
 * events, orders and tickets with organizer_id. Staff gain a nullable
 * organizer_id (NULL = platform-level staff).
 *
 * Backfill: creates one "Default Organizer" and assigns the existing event and
 * all its orders/tickets to it, so scoped queries never hide live data.
 * Existing staff stay platform-level (organizer_id NULL). Idempotent-ish:
 * only fills rows whose organizer_id is still NULL.
 */
export class OrganizerTenancy1754020000000 implements MigrationInterface {
  name = "OrganizerTenancy1754020000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Organizers table.
    await queryRunner.query(`
      CREATE TABLE "organizers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "slug" varchar(255) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'ACTIVE',
        "contact_email" varchar(320),
        "payout_notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_organizers" PRIMARY KEY ("id"),
        CONSTRAINT "chk_organizers_status"
          CHECK ("status" IN ('ACTIVE', 'SUSPENDED'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_organizers_slug" ON "organizers" ("slug")`,
    );

    // 2. organizer_id columns (nullable for now; backfilled below).
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "organizer_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "staff_users" ADD COLUMN "organizer_id" uuid`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "organizer_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD COLUMN "organizer_id" uuid`,
    );

    // 3. Backfill. Create the default organizer (borrow the existing event's
    // contact email if there is one), then tag existing data.
    await queryRunner.query(`
      INSERT INTO "organizers" ("name", "slug", "status", "contact_email")
      VALUES (
        'Default Organizer',
        'default',
        'ACTIVE',
        (SELECT "contact_email" FROM "events" ORDER BY "created_at" ASC LIMIT 1)
      )
    `);
    await queryRunner.query(`
      UPDATE "events"
         SET "organizer_id" = (SELECT "id" FROM "organizers" WHERE "slug" = 'default')
       WHERE "organizer_id" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "orders" o
         SET "organizer_id" = e."organizer_id"
        FROM "events" e
       WHERE e."id" = o."event_id" AND o."organizer_id" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "tickets" t
         SET "organizer_id" = e."organizer_id"
        FROM "events" e
       WHERE e."id" = t."event_id" AND t."organizer_id" IS NULL
    `);

    // 4. Now enforce NOT NULL on the always-owned tables.
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "organizer_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "organizer_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" ALTER COLUMN "organizer_id" SET NOT NULL`,
    );

    // 5. Indexes for tenant-scoped lookups.
    await queryRunner.query(
      `CREATE INDEX "idx_events_organizer_id" ON "events" ("organizer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_staff_users_organizer_id" ON "staff_users" ("organizer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_organizer_id" ON "orders" ("organizer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tickets_organizer_id" ON "tickets" ("organizer_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_tickets_organizer_id"`);
    await queryRunner.query(`DROP INDEX "idx_orders_organizer_id"`);
    await queryRunner.query(`DROP INDEX "idx_staff_users_organizer_id"`);
    await queryRunner.query(`DROP INDEX "idx_events_organizer_id"`);
    await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "organizer_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "organizer_id"`);
    await queryRunner.query(
      `ALTER TABLE "staff_users" DROP COLUMN "organizer_id"`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "organizer_id"`);
    await queryRunner.query(`DROP TABLE "organizers"`);
  }
}
