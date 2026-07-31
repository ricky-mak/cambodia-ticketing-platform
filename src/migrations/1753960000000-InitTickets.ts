import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 6 schema: tickets (one per sold seat).
 */
export class InitTickets1753960000000 implements MigrationInterface {
  name = "InitTickets1753960000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tickets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "order_id" uuid NOT NULL,
        "order_item_id" uuid NOT NULL,
        "zone_id" uuid NOT NULL,
        "seat_id" uuid NOT NULL,
        "ticket_number" varchar(32) NOT NULL,
        "public_token" varchar(64) NOT NULL,
        "qr_token_id" uuid NOT NULL,
        "attendee_name" varchar(255) NOT NULL,
        "attendee_email" varchar(320) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'VALID',
        "checked_in_at" timestamptz,
        "checked_in_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "fk_tickets_event" FOREIGN KEY ("event_id")
          REFERENCES "events" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_tickets_order" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_tickets_order_item" FOREIGN KEY ("order_item_id")
          REFERENCES "order_items" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_tickets_zone" FOREIGN KEY ("zone_id")
          REFERENCES "zones" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_tickets_seat" FOREIGN KEY ("seat_id")
          REFERENCES "seats" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_tickets_status" CHECK ("status" IN
          ('VALID','CHECKED_IN','CANCELLED','REFUNDED','VOID'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tickets_seat_id" ON "tickets" ("seat_id");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tickets_ticket_number" ON "tickets" ("ticket_number");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tickets_public_token" ON "tickets" ("public_token");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tickets_qr_token_id" ON "tickets" ("qr_token_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tickets_event_id" ON "tickets" ("event_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tickets_order_id" ON "tickets" ("order_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tickets_status" ON "tickets" ("status");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tickets";`);
  }
}
