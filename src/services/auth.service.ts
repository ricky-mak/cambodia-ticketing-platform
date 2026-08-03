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
  | { ok: false; locked?: boolean; lockedUntil?: Date };

// Brute-force lockout: after this many consecutive failures, lock the account
// for the cooldown window. This is global (per account, in the DB), unlike the
// per-instance IP rate limiter.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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

  // Account temporarily locked after too many failed attempts.
  if (staff.lockedUntil && staff.lockedUntil.getTime() > Date.now()) {
    await writeAudit({
      action: AuditAction.LOGIN_FAILED,
      staffUserId: staff.id,
      metadata: { ...auditMeta, reason: "locked" },
    });
    return { ok: false, locked: true, lockedUntil: staff.lockedUntil };
  }

  const passwordOk = await verifyPassword(staff.passwordHash, input.password);
  if (!passwordOk) {
    staff.failedLoginAttempts += 1;
    let locked = false;
    if (staff.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      staff.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
      staff.failedLoginAttempts = 0;
      locked = true;
    }
    await staffRepo.save(staff);
    await writeAudit({
      action: AuditAction.LOGIN_FAILED,
      staffUserId: staff.id,
      metadata: { ...auditMeta, reason: "bad_password", locked },
    });
    return {
      ok: false,
      locked,
      lockedUntil: locked ? (staff.lockedUntil ?? undefined) : undefined,
    };
  }

  const token = await createSession(staff.id, {
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
  });

  staff.lastLoginAt = new Date();
  staff.failedLoginAttempts = 0;
  staff.lockedUntil = null;
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
