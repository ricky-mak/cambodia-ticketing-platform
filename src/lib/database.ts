import "reflect-metadata";
import {
  DataSource,
  type EntityTarget,
  type ObjectLiteral,
  type Repository,
} from "typeorm";
import { getEnv } from "./env";
import { StaffUser } from "@/entities/staff-user.entity";
import { Session } from "@/entities/session.entity";
import { AuditLog } from "@/entities/audit-log.entity";
import { Event } from "@/entities/event.entity";
import { Zone } from "@/entities/zone.entity";
import { Seat } from "@/entities/seat.entity";
import { Order } from "@/entities/order.entity";
import { OrderItem } from "@/entities/order-item.entity";
import { Payment } from "@/entities/payment.entity";
import { Ticket } from "@/entities/ticket.entity";
import { CheckInLog } from "@/entities/check-in-log.entity";
import { Organizer } from "@/entities/organizer.entity";
import { Payout } from "@/entities/payout.entity";

/**
 * A single shared TypeORM DataSource.
 *
 * Cached on globalThis so that Next.js hot-reload in development and repeated
 * route-handler invocations on Cloud Run reuse one connection pool instead of
 * opening a new one each time (which would exhaust Cloud SQL connections).
 *
 * Entities are registered explicitly (added in later phases) rather than via
 * glob paths, because glob discovery breaks once the app is bundled.
 */
declare global {
  // eslint-disable-next-line no-var
  var __ticketingDataSource: DataSource | undefined;
}

function createDataSource(): DataSource {
  const env = getEnv();

  return new DataSource({
    type: "postgres",
    url: env.DATABASE_URL,
    synchronize: false,
    logging: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    entities: [
      StaffUser,
      Session,
      AuditLog,
      Event,
      Zone,
      Seat,
      Order,
      OrderItem,
      Payment,
      Ticket,
      CheckInLog,
      Organizer,
      Payout,
    ],
    // Migrations are intentionally NOT registered here. They are run only by
    // the CLI (src/data-source.ts); loading the .ts migration files at app
    // runtime would pull in type-only typeorm imports that fail under Next.
    // Keep the pool small: (Cloud Run max instances x max) must stay under the
    // Cloud SQL connection limit.
    extra: {
      max: 5,
      min: 0,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    },
  });
}

export async function getDataSource(): Promise<DataSource> {
  const existing = globalThis.__ticketingDataSource;
  if (existing?.isInitialized) {
    return existing;
  }

  const dataSource = existing ?? createDataSource();
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  globalThis.__ticketingDataSource = dataSource;
  return dataSource;
}

/**
 * Resolve a repository by ENTITY NAME rather than class reference.
 *
 * In Next.js dev, webpack instantiates the same entity class in multiple
 * module layers (React Server Components vs route handlers), so the class
 * object passed at a call site may differ from the one the DataSource was
 * initialized with — which throws EntityMetadataNotFoundError. The entity name
 * (the class name, e.g. "Session") is stable across layers, so we look up by
 * that instead. Call sites can keep passing the entity class for type safety.
 */
export async function getRepo<Entity extends ObjectLiteral>(
  target: EntityTarget<Entity>,
): Promise<Repository<Entity>> {
  const ds = await getDataSource();
  const name =
    typeof target === "function"
      ? (target as { name: string }).name
      : (target as string);
  return ds.getRepository<Entity>(name);
}
