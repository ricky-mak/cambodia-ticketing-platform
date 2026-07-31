import { getRepo } from "@/lib/database";
import { StaffUser } from "@/entities/staff-user.entity";
import { StaffStatus, AuditAction } from "@/types/enums";
import { verifyPassword } from "@/lib/password";
import { createSession, revokeCurrentSession } from "@/lib/session";
import { writeAudit } from "./audit.service";
import { logger } from "@/lib/logging";

export interface LoginInput {
  email: string;
  password: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export type LoginResult =
  | { ok: true; token: string; staff: StaffUser }
  | { ok: false };

/**
 * Authenticate a staff user and open a session. Returns a generic failure for
 * unknown email, wrong password, or disabled account so the response does not
 * leak which accounts exist.
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const staffRepo = await getRepo(StaffUser);
  const staff = await staffRepo.findOne({ where: { email } });

  const auditMeta = { email, ipAddress: input.ipAddress ?? null };

  if (!staff || staff.status !== StaffStatus.ACTIVE) {
    await writeAudit({
      action: AuditAction.LOGIN_FAILED,
      staffUserId: staff?.id ?? null,
      metadata: { ...auditMeta, reason: staff ? "disabled" : "unknown_email" },
    });
    return { ok: false };
  }

  const passwordOk = await verifyPassword(staff.passwordHash, input.password);
  if (!passwordOk) {
    await writeAudit({
      action: AuditAction.LOGIN_FAILED,
      staffUserId: staff.id,
      metadata: { ...auditMeta, reason: "bad_password" },
    });
    return { ok: false };
  }

  const token = await createSession(staff.id, {
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
  });

  staff.lastLoginAt = new Date();
  await staffRepo.save(staff);

  await writeAudit({
    action: AuditAction.LOGIN,
    staffUserId: staff.id,
    metadata: auditMeta,
  });
  logger.info("Staff login", { staffUserId: staff.id, role: staff.role });

  return { ok: true, token, staff };
}

/** Revoke the caller's current session and audit the logout. */
export async function logout(): Promise<void> {
  const staffUserId = await revokeCurrentSession();
  if (staffUserId) {
    await writeAudit({ action: AuditAction.LOGOUT, staffUserId });
  }
}
