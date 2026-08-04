import { NextResponse } from "next/server";
import { z } from "zod";
import { getSuperAdmin } from "@/lib/api-auth";
import { isSameOrigin } from "@/lib/http";
import { createStaff } from "@/services/staff.service";
import { StaffRole } from "@/types/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(12),
  role: z.nativeEnum(StaffRole),
});

export async function POST(request: Request) {
  const staff = await getSuperAdmin();
  if (!staff) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  // New staff inherit the creator's tenant: an organizer admin creates staff in
  // their own organizer; a platform admin (organizer_id NULL) creates platform
  // staff.
  const result = await createStaff(
    { ...parsed.data, organizerId: staff.organizerId },
    staff.id,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
