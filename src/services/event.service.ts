import { getRepo } from "@/lib/database";
import { Event } from "@/entities/event.entity";
import { EventStatus } from "@/types/enums";
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
