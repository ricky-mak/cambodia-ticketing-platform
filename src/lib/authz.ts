import { StaffRole } from "@/types/enums";

/**
 * Authorization helpers. Roles are not a strict hierarchy: CHECK_IN_STAFF is a
 * separate track from the admin roles, so capabilities are expressed as
 * explicit role sets rather than numeric levels.
 */

// Roles allowed into the admin dashboard area.
export const ADMIN_AREA_ROLES: StaffRole[] = [
  StaffRole.ADMIN,
  StaffRole.MANAGER,
];

// Roles allowed into the check-in area (added in Phase 7).
export const CHECK_IN_AREA_ROLES: StaffRole[] = [
  StaffRole.ADMIN,
  StaffRole.MANAGER,
  StaffRole.CHECK_IN_STAFF,
];

export function hasRole(role: StaffRole, allowed: StaffRole[]): boolean {
  return allowed.includes(role);
}

export function canAccessAdmin(role: StaffRole): boolean {
  return hasRole(role, ADMIN_AREA_ROLES);
}

export function canAccessCheckIn(role: StaffRole): boolean {
  return hasRole(role, CHECK_IN_AREA_ROLES);
}

/**
 * Platform admin = an ADMIN with no owning organizer (organizer_id NULL). Only
 * platform admins may manage organizers. Organizer-scoped admins are excluded.
 */
export function isPlatformAdmin(staff: {
  role: StaffRole;
  organizerId: string | null;
}): boolean {
  return staff.role === StaffRole.ADMIN && staff.organizerId === null;
}
