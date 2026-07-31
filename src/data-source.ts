import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { DataSource } from "typeorm";

// Load .env.local first (Next.js dev convention), then .env as a fallback.
// dotenv does not override variables that are already set, so .env.local wins.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Standalone DataSource used only by the TypeORM CLI for migrations
 * (see the migration:* scripts in package.json). It reads the same
 * DATABASE_URL from .env / .env.local via dotenv.
 *
 * The application runtime uses src/lib/database.ts instead.
 */
export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: ["error", "warn"],
  entities: ["src/entities/*.ts"],
  migrations: ["src/migrations/*.ts"],
});
