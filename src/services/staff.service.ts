import { getRepo } from "@/lib/database";
import { StaffUser } from "@/entities/staff-user.entity";
import { AuditAction, StaffRole, StaffStatus } from "@/types/enums";
import { hashPassword } from "@/lib/password";
import { writeAudit } from "./audit.service";

export interface StaffListRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
}

/**
 * Staff visible to a tenant scope. Platform staff (organizerId === null) see
 * everyone; an organizer admin sees only their own organizer's staff.
 */
export async function listStaff(
  organizerId: string | null,
): Promise<StaffListRow[]> {
  const repo = await getRepo(StaffUser);
  const staff =
    organizerId === null
      ? await repo.find({ order: { createdAt: "ASC" } })
      : await repo.find({ where: { organizerId }, order: { createdAt: "ASC" } });
  return staff.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    status: s.status,
    lastLoginAt: s.lastLoginAt ? s.lastLoginAt.toISOString() : null,
  }));
}

export async function createStaff(
  input: {
    name: string;
    email: string;
    password: string;
    role: StaffRole;
    // Owning organizer for the new account. null = platform-level staff.
    organizerId: string | null;
  },
  actorId: string,
): Promise<{ ok: boolean; reason?: string; id?: string }> {
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 12) {
    return { ok: false, reason: "password_too_short" };
  }
  const repo = await getRepo(StaffUser);
  const existing = await repo.findOne({ where: { email } });
  if (existing) return { ok: false, reason: "email_taken" };

  const staff = repo.create({
    name: input.name.trim(),
    email,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    status: StaffStatus.ACTIVE,
    organizerId: input.organizerId,
  });
  await repo.save(staff);
  await writeAudit({
    staffUserId: actorId,
    action: AuditAction.STAFF_CREATED,
    entityType: "staff_user",
    entityId: staff.id,
    newData: { email, role: input.role },
  });
  return { ok: true, id: staff.id };
}

export async function setStaffStatus(
  id: string,
  status: StaffStatus,
  actorId: string,
): Promise<{ ok: boolean }> {
  const repo = await getRepo(StaffUser);
  // Re-enabling an account also clears any brute-force lockout.
  const patch =
    status === StaffStatus.ACTIVE
      ? { status, failedLoginAttempts: 0, lockedUntil: null }
      : { status };
  const result = await repo.update({ id }, patch);
  if (result.affected === 1) {
    await writeAudit({
      staffUserId: actorId,
      action:
        status === StaffStatus.DISABLED
          ? AuditAction.STAFF_DISABLED
          : AuditAction.STAFF_UPDATED,
      entityType: "staff_user",
      entityId: id,
      newData: { status },
    });
    return { ok: true };
  }
  return { ok: false };
}

export async function setStaffRole(
  id: string,
  role: StaffRole,
  actorId: string,
): Promise<{ ok: boolean }> {
  const repo = await getRepo(StaffUser);
  const result = await repo.update({ id }, { role });
  if (result.affected === 1) {
    await writeAudit({
      staffUserId: actorId,
      action: AuditAction.STAFF_UPDATED,
      entityType: "staff_user",
      entityId: id,
      newData: { role },
    });
    return { ok: true };
  }
  return { ok: false };
}

export async function resetStaffPassword(
  id: string,
  newPassword: string,
  actorId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (newPassword.length < 12) {
    return { ok: false, reason: "password_too_short" };
  }
  const repo = await getRepo(StaffUser);
  const result = await repo.update(
    { id },
    {
      passwordHash: await hashPassword(newPassword),
      // Resetting the password also clears any brute-force lockout.
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  );
  if (result.affected === 1) {
    await writeAudit({
      staffUserId: actorId,
      action: AuditAction.STAFF_PASSWORD_RESET,
      entityType: "staff_user",
      entityId: id,
    });
    return { ok: true };
  }
  return { ok: false };
}
