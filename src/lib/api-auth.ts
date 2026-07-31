import { getCurrentStaff } from "@/lib/session";
import { canAccessAdmin, canAccessCheckIn } from "@/lib/authz";
import { StaffRole } from "@/types/enums";
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
