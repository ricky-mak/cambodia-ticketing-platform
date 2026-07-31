import { cookies } from "next/headers";
import crypto from "node:crypto";
import { LessThan } from "typeorm";
import { getRepo } from "./database";
import { Session } from "@/entities/session.entity";
import { StaffUser } from "@/entities/staff-user.entity";
import { StaffStatus } from "@/types/enums";
import { SESSION_COOKIE } from "./session-cookie";

export { SESSION_COOKIE };
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface SessionContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/** Create a session row and return the raw token to put in the cookie. */
export async function createSession(
  staffUserId: string,
  ctx: SessionContext = {},
): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const repo = await getRepo(Session);

  const session = repo.create({
    tokenHash: hashToken(token),
    staffUserId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    userAgent: ctx.userAgent ?? null,
    ipAddress: ctx.ipAddress ?? null,
    lastUsedAt: new Date(),
  });
  await repo.save(session);

  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

async function readTokenFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Resolve the currently authenticated staff user, or null. Also enforces that
 * the session is not expired/revoked and that the account is still ACTIVE, so
 * disabling an account takes effect on the next request.
 */
export async function getCurrentStaff(): Promise<StaffUser | null> {
  const token = await readTokenFromCookie();
  if (!token) return null;

  const session = await (await getRepo(Session)).findOne({
    where: { tokenHash: hashToken(token) },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  const staff = await (await getRepo(StaffUser)).findOne({
    where: { id: session.staffUserId },
  });

  if (!staff || staff.status !== StaffStatus.ACTIVE) return null;

  return staff;
}

/** Revoke the caller's current session (logout). Returns the staff id if any. */
export async function revokeCurrentSession(): Promise<string | null> {
  const token = await readTokenFromCookie();
  if (!token) return null;

  const repo = await getRepo(Session);
  const session = await repo.findOne({
    where: { tokenHash: hashToken(token) },
  });
  if (!session) return null;

  session.revokedAt = new Date();
  await repo.save(session);
  return session.staffUserId;
}

/** Housekeeping: delete expired/revoked sessions. Called opportunistically. */
export async function purgeExpiredSessions(): Promise<void> {
  const repo = await getRepo(Session);
  await repo.delete({ expiresAt: LessThan(new Date()) });
}
