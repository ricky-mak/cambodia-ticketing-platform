import { getRepo } from "@/lib/database";
import { Organizer } from "@/entities/organizer.entity";
import { OrganizerStatus } from "@/types/enums";

export interface OrganizerInput {
  name: string;
  slug: string;
  contactEmail?: string | null;
  payoutNotes?: string | null;
}

export async function listOrganizers(): Promise<Organizer[]> {
  const repo = await getRepo(Organizer);
  return repo.find({ order: { createdAt: "ASC" } });
}

export async function getOrganizerById(
  id: string,
): Promise<Organizer | null> {
  const repo = await getRepo(Organizer);
  return repo.findOne({ where: { id } });
}

/**
 * The seeded "default" organizer created by the tenancy migration. Used as the
 * fallback owner while the platform is still effectively single-tenant (e.g.
 * new events created before organizer selection exists in the UI).
 */
export async function getDefaultOrganizer(): Promise<Organizer | null> {
  const repo = await getRepo(Organizer);
  return repo.findOne({ where: { slug: "default" } });
}

export async function getDefaultOrganizerId(): Promise<string> {
  const organizer = await getDefaultOrganizer();
  if (!organizer) {
    // Should never happen: the migration seeds it. Fail loudly rather than
    // silently writing an event with no tenant.
    throw new Error("Default organizer is missing — run migrations.");
  }
  return organizer.id;
}

export async function createOrganizer(
  input: OrganizerInput,
): Promise<Organizer> {
  const repo = await getRepo(Organizer);
  const organizer = repo.create({
    name: input.name,
    slug: input.slug,
    contactEmail: input.contactEmail ?? null,
    payoutNotes: input.payoutNotes ?? null,
    status: OrganizerStatus.ACTIVE,
  });
  return repo.save(organizer);
}
