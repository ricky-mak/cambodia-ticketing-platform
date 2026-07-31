import { getRepo } from "@/lib/database";
import { Event } from "@/entities/event.entity";
import { EventStatus } from "@/types/enums";

export interface EventInput {
  name: string;
  slug: string;
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

export async function getPublishedEvent(): Promise<Event | null> {
  const repo = await getRepo(Event);
  return repo.findOne({ where: { status: EventStatus.PUBLISHED } });
}

export async function createEvent(input: EventInput): Promise<Event> {
  const repo = await getRepo(Event);
  const event = repo.create({
    ...input,
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
