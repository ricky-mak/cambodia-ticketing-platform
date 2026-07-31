import { NextResponse } from "next/server";
import { z } from "zod";
import { getSuperAdmin } from "@/lib/api-auth";
import { isSameOrigin } from "@/lib/http";
import {
  setStaffStatus,
  setStaffRole,
  resetStaffPassword,
} from "@/services/staff.service";
import { StaffRole, StaffStatus } from "@/types/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.nativeEnum(StaffStatus).optional(),
  role: z.nativeEnum(StaffRole).optional(),
  password: z.string().min(12).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const d = parsed.data;
  if (d.status) return NextResponse.json(await setStaffStatus(id, d.status, actor.id));
  if (d.role) return NextResponse.json(await setStaffRole(id, d.role, actor.id));
  if (d.password) {
    const r = await resetStaffPassword(id, d.password, actor.id);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, reason: "no_change" }, { status: 400 });
}
