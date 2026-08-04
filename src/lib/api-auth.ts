import { getCurrentStaff } from "@/lib/session";
import { canAccessAdmin, canAccessCheckIn } from "@/lib/authz";
import { StaffRole } from "@/types/enums";
import { getTenantScope, type TenantScope } from "@/lib/tenant";
import type { StaffUser } from "@/entities/staff-user.entity";

/**
 * Returns the current staff member if they may use the admin area, otherwise
 * null. Use in admin API route handlers to gate access:
 *
 *   const staff = await getAdminStaff();
 *   if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export async function getAdminStaff(): Promise<StaffUser | null> {
  const staff = await getCurrentStaff();
  if (!staff || !canAccessAdmin(staff.role)) return null;
  return staff;
}

/** Returns the current staff member if they may use the check-in area, else null. */
export async function getCheckInStaff(): Promise<StaffUser | null> {
  const staff = await getCurrentStaff();
  if (!staff || !canAccessCheckIn(staff.role)) return null;
  return staff;
}

/** Returns the current staff member only if they are an ADMIN, else null. */
export async function getSuperAdmin(): Promise<StaffUser | null> {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== StaffRole.ADMIN) return null;
  return staff;
}

/**
 * Returns the current staff member only if they are a PLATFORM admin — an
 * ADMIN whose organizer_id is NULL (the operator). Gates platform-only surfaces
 * such as managing organizers. Organizer-scoped admins are rejected here.
 */
export async function getPlatformAdmin(): Promise<StaffUser | null> {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== StaffRole.ADMIN || staff.organizerId !== null) {
    return null;
  }
  return staff;
}

/**
 * Admin-area gate that also returns the caller's tenant scope, so handlers can
 * constrain queries to the right organizer. Returns null if not an admin.
 */
export async function getScopedAdminStaff(): Promise<{
  staff: StaffUser;
  scope: TenantScope;
} | null> {
  const staff = await getAdminStaff();
  if (!staff) return null;
  return { staff, scope: getTenantScope(staff) };
}
