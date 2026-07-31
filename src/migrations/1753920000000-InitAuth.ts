import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 2 schema: staff users, server-side sessions, and the audit log.
 * Requires PostgreSQL 13+ (uses the built-in gen_random_uuid()).
 */
export class InitAuth1753920000000 implements MigrationInterface {
  name = "InitAuth1753920000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "staff_users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "email" varchar(320) NOT NULL,
        "password_hash" text NOT NULL,
        "role" varchar(32) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'ACTIVE',
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_staff_users" PRIMARY KEY ("id"),
        CONSTRAINT "chk_staff_users_role"
          CHECK ("role" IN ('ADMIN', 'MANAGER', 'CHECK_IN_STAFF')),
        CONSTRAINT "chk_staff_users_status"
          CHECK ("status" IN ('ACTIVE', 'DISABLED'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_staff_users_email" ON "staff_users" ("email");`,
    );

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "token_hash" varchar(64) NOT NULL,
        "staff_user_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "last_used_at" timestamptz,
        "user_agent" text,
        "ip_address" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "fk_sessions_staff_user"
          FOREIGN KEY ("staff_user_id") REFERENCES "staff_users" ("id")
          ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sessions_token_hash" ON "sessions" ("token_hash");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sessions_staff_user_id" ON "sessions" ("staff_user_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "staff_user_id" uuid,
        "action" varchar(64) NOT NULL,
        "entity_type" varchar(64),
        "entity_id" varchar(64),
        "previous_data" jsonb,
        "new_data" jsonb,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_audit_logs_staff_user"
          FOREIGN KEY ("staff_user_id") REFERENCES "staff_users" ("id")
          ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_staff_user_id" ON "audit_logs" ("staff_user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_action" ON "audit_logs" ("action");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs";`);
    await queryRunner.query(`DROP TABLE "sessions";`);
    await queryRunner.query(`DROP TABLE "staff_users";`);
  }
}
