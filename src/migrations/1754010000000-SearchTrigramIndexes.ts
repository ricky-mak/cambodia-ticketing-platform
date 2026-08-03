import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Speeds up the check-in / attendee search, which matches with leading-wildcard
 * `ILIKE '%term%'` on names, emails, ticket numbers and order numbers. A normal
 * btree index can't serve a leading wildcard, so we add GIN **trigram** indexes
 * (`pg_trgm`), which do. Without these, each search is a sequential scan over
 * ~60k tickets — fine occasionally, but slow when many gates search at once on
 * event day.
 */
export class SearchTrigramIndexes1754010000000 implements MigrationInterface {
  name = "SearchTrigramIndexes1754010000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    await queryRunner.query(
      `CREATE INDEX "idx_tickets_attendee_name_trgm" ON "tickets"
         USING gin ("attendee_name" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tickets_attendee_email_trgm" ON "tickets"
         USING gin ("attendee_email" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tickets_ticket_number_trgm" ON "tickets"
         USING gin ("ticket_number" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_order_number_trgm" ON "orders"
         USING gin ("order_number" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_orders_order_number_trgm"`);
    await queryRunner.query(`DROP INDEX "idx_tickets_ticket_number_trgm"`);
    await queryRunner.query(`DROP INDEX "idx_tickets_attendee_email_trgm"`);
    await queryRunner.query(`DROP INDEX "idx_tickets_attendee_name_trgm"`);
    // Leave the pg_trgm extension in place — other objects may rely on it.
  }
}
