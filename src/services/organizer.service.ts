import { getDataSource, getRepo } from "@/lib/database";
import { Organizer } from "@/entities/organizer.entity";
import { StaffUser } from "@/entities/staff-user.entity";
import { AuditAction, OrganizerStatus, StaffRole, StaffStatus } from "@/types/enums";
import { hashPassword } from "@/lib/password";
import { writeAudit } from "./audit.service";

export interface OrganizerInput {
  name: string;
  slug: string;
  contactEmail?: string | null;
  payoutNotes?: string | null;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export interface OrganizerStatsRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactEmail: string | null;
  eventCount: number;
  paidOrders: number;
  createdAt: string;
}

/** Platform overview: every organizer with a few tenant-scoped counts. */
export async function listOrganizersWithStats(): Promise<OrganizerStatsRow[]> {
  const ds = await getDataSource();
  const rows: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    contact_email: string | null;
    event_count: number;
    paid_orders: number;
    created_at: Date;
  }> = await ds.query(
    `SELECT o.id, o.name, o.slug, o.status, o.contact_email, o.created_at,
            (SELECT count(*)::int FROM events e WHERE e.organizer_id = o.id)
              AS event_count,
            (SELECT count(*)::int FROM orders ord
              WHERE ord.organizer_id = o.id AND ord.status = 'PAID')
              AS paid_orders
       FROM organizers o
      ORDER BY o.created_at ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    contactEmail: r.contact_email,
    eventCount: r.event_count,
    paidOrders: r.paid_orders,
    createdAt: r.created_at.toISOString(),
  }));
}

export interface CreateOrganizerWithAdminInput {
  name: string;
  slug: string;
  contactEmail?: string | null;
  payoutNotes?: string | null;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

/**
 * Invite-only onboarding: create an organizer together with its first
 * organizer-admin (an ADMIN whose organizer_id is this organizer). Both rows
 * are written in one transaction so we never leave an organizer without an
 * admin. Validates slug/email/password up front.
 */
export async function createOrganizerWithAdmin(
  input: CreateOrganizerWithAdminInput,
  actorId: string,
): Promise<{ ok: boolean; reason?: string; organizerId?: string }> {
  const slug = input.slug.trim().toLowerCase();
  const adminEmail = input.adminEmail.trim().toLowerCase();

  if (!SLUG_RE.test(slug)) return { ok: false, reason: "invalid_slug" };
  if (input.adminPassword.length < 12) {
    return { ok: false, reason: "password_too_short" };
  }

  const orgRepo = await getRepo(Organizer);
  if (await orgRepo.findOne({ where: { slug } })) {
    return { ok: false, reason: "slug_taken" };
  }
  const staffRepo = await getRepo(StaffUser);
  if (await staffRepo.findOne({ where: { email: adminEmail } })) {
    return { ok: false, reason: "email_taken" };
  }

  const passwordHash = await hashPassword(input.adminPassword);
  const ds = await getDataSource();
  const ids = await ds.transaction(async (manager) => {
    const org = manager.getRepository<Organizer>("Organizer").create({
      name: input.name.trim(),
      slug,
      contactEmail: input.contactEmail?.trim() || null,
      payoutNotes: input.payoutNotes?.trim() || null,
      status: OrganizerStatus.ACTIVE,
    });
    await manager.getRepository<Organizer>("Organizer").save(org);

    const admin = manager.getRepository<StaffUser>("StaffUser").create({
      name: input.adminName.trim(),
      email: adminEmail,
      passwordHash,
      role: StaffRole.ADMIN,
      status: StaffStatus.ACTIVE,
      organizerId: org.id,
    });
    await manager.getRepository<StaffUser>("StaffUser").save(admin);
    return { orgId: org.id, staffId: admin.id };
  });

  await writeAudit({
    staffUserId: actorId,
    action: AuditAction.ORGANIZER_CREATED,
    entityType: "organizer",
    entityId: ids.orgId,
    newData: { name: input.name.trim(), slug, adminEmail },
  });
  await writeAudit({
    staffUserId: actorId,
    action: AuditAction.STAFF_CREATED,
    entityType: "staff_user",
    entityId: ids.staffId,
    newData: { email: adminEmail, role: StaffRole.ADMIN, organizerId: ids.orgId },
  });

  return { ok: true, organizerId: ids.orgId };
}

export async function updateOrganizer(
  id: string,
  input: { name?: string; contactEmail?: string | null; payoutNotes?: string | null },
  actorId: string,
): Promise<{ ok: boolean }> {
  const repo = await getRepo(Organizer);
  const organizer = await repo.findOne({ where: { id } });
  if (!organizer) return { ok: false };
  if (input.name !== undefined) organizer.name = input.name.trim();
  if (input.contactEmail !== undefined) {
    organizer.contactEmail = input.contactEmail?.trim() || null;
  }
  if (input.payoutNotes !== undefined) {
    organizer.payoutNotes = input.payoutNotes?.trim() || null;
  }
  await repo.save(organizer);
  await writeAudit({
    staffUserId: actorId,
    action: AuditAction.ORGANIZER_UPDATED,
    entityType: "organizer",
    entityId: id,
  });
  return { ok: true };
}

export async function setOrganizerStatus(
  id: string,
  status: OrganizerStatus,
  actorId: string,
): Promise<{ ok: boolean }> {
  const repo = await getRepo(Organizer);
  const result = await repo.update({ id }, { status });
  if (result.affected !== 1) return { ok: false };
  await writeAudit({
    staffUserId: actorId,
    action: AuditAction.ORGANIZER_STATUS_CHANGED,
    entityType: "organizer",
    entityId: id,
    newData: { status },
  });
  return { ok: true };
}

export async function listEventsForOrganizer(
  organizerId: string,
): Promise<Array<{ id: string; name: string; status: string }>> {
  const ds = await getDataSource();
  return ds.query(
    `SELECT id, name, status FROM events
      WHERE organizer_id = $1 ORDER BY created_at ASC`,
    [organizerId],
  );
}

export async function listStaffForOrganizer(
  organizerId: string,
): Promise<Array<{ id: string; name: string; email: string; role: string; status: string }>> {
  const ds = await getDataSource();
  return ds.query(
    `SELECT id, name, email, role, status FROM staff_users
      WHERE organizer_id = $1 ORDER BY created_at ASC`,
    [organizerId],
  );
}
