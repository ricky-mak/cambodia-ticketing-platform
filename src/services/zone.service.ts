import { getDataSource, getRepo } from "@/lib/database";
import type { Repository } from "typeorm";
import { Zone } from "@/entities/zone.entity";
import { Seat } from "@/entities/seat.entity";
import { SeatStatus, ZoneStatus } from "@/types/enums";
import { rowLabelForIndex } from "@/lib/seat-labels";

const SEAT_INSERT_CHUNK = 1000;
const MAX_SEATS_PER_ZONE = 100_000;

export interface CreateZoneInput {
  eventId: string;
  name: string;
  description?: string | null;
  priceMinor: number;
  currency?: string;
  maxPerOrder?: number;
  displayOrder?: number;
  rows: number;
  seatsPerRow: number;
}

export interface UpdateZoneInput {
  name?: string;
  description?: string | null;
  priceMinor?: number;
  maxPerOrder?: number;
  displayOrder?: number;
  status?: ZoneStatus;
}

export interface SeatCounts {
  total: number;
  available: number;
  held: number;
  sold: number;
  blocked: number;
}

export interface ZoneWithCounts {
  zone: Zone;
  counts: SeatCounts;
}

/**
 * Create a zone and generate its seats (rows x seatsPerRow) atomically.
 * Row labels are A, B, ... Z, AA, ...; seats are numbered 1..seatsPerRow.
 */
export async function createZone(input: CreateZoneInput): Promise<Zone> {
  const rows = Math.trunc(input.rows);
  const seatsPerRow = Math.trunc(input.seatsPerRow);
  if (rows < 1 || seatsPerRow < 1) {
    throw new Error("rows and seatsPerRow must be positive integers");
  }
  const totalSeats = rows * seatsPerRow;
  if (totalSeats > MAX_SEATS_PER_ZONE) {
    throw new Error(`A zone cannot exceed ${MAX_SEATS_PER_ZONE} seats`);
  }
  if (input.priceMinor < 0 || !Number.isInteger(input.priceMinor)) {
    throw new Error("priceMinor must be a non-negative integer");
  }

  const ds = await getDataSource();
  return ds.transaction(async (manager) => {
    const zoneRepo = manager.getRepository<Zone>("Zone");
    const seatRepo = manager.getRepository<Seat>("Seat");

    const zone = zoneRepo.create({
      eventId: input.eventId,
      name: input.name,
      description: input.description ?? null,
      priceMinor: input.priceMinor,
      currency: input.currency ?? "USD",
      maxPerOrder: input.maxPerOrder ?? 10,
      displayOrder: input.displayOrder ?? 0,
      totalSeats,
      status: ZoneStatus.ACTIVE,
    });
    await zoneRepo.save(zone);

    let batch: Array<Partial<Seat>> = [];
    for (let r = 0; r < rows; r++) {
      const rowLabel = rowLabelForIndex(r);
      for (let n = 1; n <= seatsPerRow; n++) {
        batch.push({
          eventId: input.eventId,
          zoneId: zone.id,
          rowLabel,
          seatNumber: n,
          status: SeatStatus.AVAILABLE,
        });
        if (batch.length >= SEAT_INSERT_CHUNK) {
          await seatRepo.insert(batch);
          batch = [];
        }
      }
    }
    if (batch.length > 0) {
      await seatRepo.insert(batch);
    }

    return zone;
  });
}

export async function updateZone(
  id: string,
  input: UpdateZoneInput,
): Promise<Zone> {
  const repo = await getRepo(Zone);
  const zone = await repo.findOne({ where: { id } });
  if (!zone) throw new Error("Zone not found");
  repo.merge(zone, input);
  return repo.save(zone);
}

/** Per-zone seat counts for an event, keyed by zone id. */
async function getSeatCounts(
  eventId: string,
): Promise<Map<string, SeatCounts>> {
  const ds = await getDataSource();
  const rows: Array<{ zone_id: string; status: string; count: number }> =
    await ds.query(
      `SELECT zone_id, status, count(*)::int AS count
         FROM seats
        WHERE event_id = $1
        GROUP BY zone_id, status`,
      [eventId],
    );

  const map = new Map<string, SeatCounts>();
  for (const row of rows) {
    const counts =
      map.get(row.zone_id) ??
      { total: 0, available: 0, held: 0, sold: 0, blocked: 0 };
    counts.total += row.count;
    if (row.status === SeatStatus.AVAILABLE) counts.available += row.count;
    else if (row.status === SeatStatus.HELD) counts.held += row.count;
    else if (row.status === SeatStatus.SOLD) counts.sold += row.count;
    else if (row.status === SeatStatus.BLOCKED) counts.blocked += row.count;
    map.set(row.zone_id, counts);
  }
  return map;
}

async function withCounts(
  eventId: string,
  zoneRepo: Repository<Zone>,
  where: Record<string, unknown>,
): Promise<ZoneWithCounts[]> {
  const zones = await zoneRepo.find({
    where,
    order: { displayOrder: "ASC", createdAt: "ASC" },
  });
  const counts = await getSeatCounts(eventId);
  return zones.map((zone) => ({
    zone,
    counts:
      counts.get(zone.id) ??
      { total: zone.totalSeats, available: 0, held: 0, sold: 0, blocked: 0 },
  }));
}

/** All zones for the admin list, with live seat counts. */
export async function listZonesWithCounts(
  eventId: string,
): Promise<ZoneWithCounts[]> {
  const zoneRepo = await getRepo(Zone);
  return withCounts(eventId, zoneRepo, { eventId });
}

export async function getZoneById(id: string): Promise<Zone | null> {
  const repo = await getRepo(Zone);
  return repo.findOne({ where: { id } });
}

export async function countAvailableSeats(zoneId: string): Promise<number> {
  const ds = await getDataSource();
  const rows: Array<{ count: number }> = await ds.query(
    `SELECT count(*)::int AS count FROM seats WHERE zone_id = $1 AND status = 'AVAILABLE'`,
    [zoneId],
  );
  return rows[0]?.count ?? 0;
}

/** Active zones for the public landing page, with live availability. */
export async function listPublicZones(
  eventId: string,
): Promise<ZoneWithCounts[]> {
  const zoneRepo = await getRepo(Zone);
  return withCounts(eventId, zoneRepo, {
    eventId,
    status: ZoneStatus.ACTIVE,
  });
}
