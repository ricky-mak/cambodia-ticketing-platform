import { getDataSource, getRepo } from "@/lib/database";
import { Event } from "@/entities/event.entity";
import { Organizer } from "@/entities/organizer.entity";
import { EventStatus, OrganizerStatus } from "@/types/enums";
import { getDefaultOrganizerId } from "@/services/organizer.service";

export interface EventInput {
  name: string;
  slug: string;
  // Owning organizer. Optional at the input layer for now: when omitted, new
  // events fall back to the default organizer (single-tenant behaviour). An
  // organizer picker will supply this once the platform admin UI lands.
  organizerId?: string;
  description?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  heroImageUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  refundPolicy?: string | null;
  terms?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  salesStartAt?: Date | null;
  salesEndAt?: Date | null;
  currency?: string;
  reservationMinutes?: number;
  maxPendingPerEmail?: number;
  maxPendingPerIp?: number;
}

/** This is a single-event system: the "primary" event is the earliest one. */
export async function getPrimaryEvent(): Promise<Event | null> {
  const repo = await getRepo(Event);
  return repo.findOne({ where: {}, order: { createdAt: "ASC" } });
}

export async function getEventById(id: string): Promise<Event | null> {
  const repo = await getRepo(Event);
  return repo.findOne({ where: { id } });
}

/**
 * Events visible to a tenant scope: all events for platform staff
 * (organizerId === null), otherwise just that organizer's events.
 */
export async function listEventsForScope(
  organizerId: string | null,
): Promise<Event[]> {
  const repo = await getRepo(Event);
  if (organizerId === null) {
    return repo.find({ order: { createdAt: "ASC" } });
  }
  return repo.find({ where: { organizerId }, order: { createdAt: "ASC" } });
}

export async function getPublishedEvent(): Promise<Event | null> {
  const repo = await getRepo(Event);
  return repo.findOne({ where: { status: EventStatus.PUBLISHED } });
}

export interface MarketplaceEvent {
  id: string;
  name: string;
  slug: string;
  startsAt: Date | null;
  venueName: string | null;
  heroImageUrl: string | null;
}

/**
 * All events on sale to the public: PUBLISHED and owned by an ACTIVE organizer
 * (a suspended organizer's events disappear from the marketplace). Ordered by
 * start date.
 */
export async function listPublishedEventsForMarketplace(): Promise<
  MarketplaceEvent[]
> {
  const ds = await getDataSource();
  const rows: Array<{
    id: string;
    name: string;
    slug: string;
    starts_at: Date | null;
    venue_name: string | null;
    hero_image_url: string | null;
  }> = await ds.query(
    `SELECT e.id, e.name, e.slug, e.starts_at, e.venue_name, e.hero_image_url
       FROM events e
       JOIN organizers o ON o.id = e.organizer_id
      WHERE e.status = 'PUBLISHED' AND o.status = 'ACTIVE'
      ORDER BY e.starts_at ASC NULLS LAST, e.created_at ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    startsAt: r.starts_at ? new Date(r.starts_at) : null,
    venueName: r.venue_name,
    heroImageUrl: r.hero_image_url,
  }));
}

/**
 * A single public event by slug — only if PUBLISHED and its organizer is
 * ACTIVE. Returns null otherwise (so suspended organizers / unpublished events
 * 404 on the public site).
 */
export async function getPublishedEventBySlug(
  slug: string,
): Promise<Event | null> {
  const repo = await getRepo(Event);
  const event = await repo.findOne({
    where: { slug, status: EventStatus.PUBLISHED },
  });
  if (!event) return null;
  const organizer = await (await getRepo(Organizer)).findOne({
    where: { id: event.organizerId },
  });
  if (!organizer || organizer.status !== OrganizerStatus.ACTIVE) return null;
  return event;
}

export async function createEvent(input: EventInput): Promise<Event> {
  const repo = await getRepo(Event);
  const organizerId = input.organizerId ?? (await getDefaultOrganizerId());
  const event = repo.create({
    ...input,
    organizerId,
    currency: input.currency ?? "USD",
    status: EventStatus.DRAFT,
  });
  return repo.save(event);
}

export async function updateEvent(
  id: string,
  input: EventInput,
): Promise<Event> {
  const repo = await getRepo(Event);
  const event = await repo.findOne({ where: { id } });
  if (!event) throw new Error("Event not found");
  // Strip undefined so optional/omitted fields don't overwrite existing values
  // (null is preserved — it explicitly clears a nullable field).
  const clean = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
  repo.merge(event, clean);
  return repo.save(event);
}

export async function setEventStatus(
  id: string,
  status: EventStatus,
): Promise<Event> {
  const repo = await getRepo(Event);
  const event = await repo.findOne({ where: { id } });
  if (!event) throw new Error("Event not found");
  event.status = status;
  return repo.save(event);
}
