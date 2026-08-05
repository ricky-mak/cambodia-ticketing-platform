import { describe, it, expect } from "vitest";
import {
  getTenantScope,
  inScope,
  resolveOrganizerFilter,
  type TenantScope,
} from "@/lib/tenant";
import { isPlatformAdmin } from "@/lib/authz";
import { StaffRole } from "@/types/enums";
import type { StaffUser } from "@/entities/staff-user.entity";

// Minimal staff stubs; only the fields the scope helpers read matter.
function staff(role: StaffRole, organizerId: string | null): StaffUser {
  return { role, organizerId } as StaffUser;
}

const ORG_A = "00000000-0000-0000-0000-00000000000a";
const ORG_B = "00000000-0000-0000-0000-00000000000b";

describe("getTenantScope", () => {
  it("treats null organizer_id as platform (sees all)", () => {
    const scope = getTenantScope(staff(StaffRole.ADMIN, null));
    expect(scope).toEqual({ isPlatform: true, organizerId: null });
  });

  it("binds organizer staff to their organizer", () => {
    const scope = getTenantScope(staff(StaffRole.MANAGER, ORG_A));
    expect(scope).toEqual({ isPlatform: false, organizerId: ORG_A });
  });
});

describe("inScope (the ownership choke point)", () => {
  const platform: TenantScope = { isPlatform: true, organizerId: null };
  const orgA: TenantScope = { isPlatform: false, organizerId: ORG_A };

  it("platform staff can see any organizer's resource", () => {
    expect(inScope(platform, ORG_A)).toBe(true);
    expect(inScope(platform, ORG_B)).toBe(true);
  });

  it("organizer staff can only see their own resources", () => {
    expect(inScope(orgA, ORG_A)).toBe(true);
    expect(inScope(orgA, ORG_B)).toBe(false); // cross-tenant denied
  });
});

describe("resolveOrganizerFilter", () => {
  const platform: TenantScope = { isPlatform: true, organizerId: null };
  const orgA: TenantScope = { isPlatform: false, organizerId: ORG_A };

  it("platform: no constraint unless one is requested", () => {
    expect(resolveOrganizerFilter(platform)).toBeNull();
    expect(resolveOrganizerFilter(platform, ORG_B)).toBe(ORG_B);
  });

  it("organizer: always forced to their own, ignoring any requested value", () => {
    expect(resolveOrganizerFilter(orgA)).toBe(ORG_A);
    expect(resolveOrganizerFilter(orgA, ORG_B)).toBe(ORG_A);
  });

  it("organizer with no organizer bound is refused (undefined)", () => {
    const broken: TenantScope = { isPlatform: false, organizerId: null };
    expect(resolveOrganizerFilter(broken, ORG_A)).toBeUndefined();
  });
});

describe("isPlatformAdmin", () => {
  it("only an ADMIN with no organizer is a platform admin", () => {
    expect(isPlatformAdmin({ role: StaffRole.ADMIN, organizerId: null })).toBe(
      true,
    );
    expect(isPlatformAdmin({ role: StaffRole.ADMIN, organizerId: ORG_A })).toBe(
      false,
    );
    expect(
      isPlatformAdmin({ role: StaffRole.MANAGER, organizerId: null }),
    ).toBe(false);
    expect(
      isPlatformAdmin({ role: StaffRole.CHECK_IN_STAFF, organizerId: null }),
    ).toBe(false);
  });
});
