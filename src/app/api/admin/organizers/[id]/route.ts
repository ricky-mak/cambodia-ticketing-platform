import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformAdmin } from "@/lib/api-auth";
import { isSameOrigin } from "@/lib/http";
import {
  setOrganizerStatus,
  updateOrganizer,
} from "@/services/organizer.service";
import { OrganizerStatus } from "@/types/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).optional(),
  contactEmail: z.string().trim().email().or(z.literal("")).optional(),
  payoutNotes: z.string().trim().optional(),
  status: z.nativeEnum(OrganizerStatus).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await getPlatformAdmin();
  if (!staff) {
    return NextResponse.json({ error: "Platform admins only" }, { status: 403 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  if (parsed.data.status) {
    const r = await setOrganizerStatus(id, parsed.data.status, staff.id);
    if (!r.ok) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
  }

  const hasFields =
    parsed.data.name !== undefined ||
    parsed.data.contactEmail !== undefined ||
    parsed.data.payoutNotes !== undefined;
  if (hasFields) {
    const r = await updateOrganizer(
      id,
      {
        name: parsed.data.name,
        contactEmail: parsed.data.contactEmail,
        payoutNotes: parsed.data.payoutNotes,
      },
      staff.id,
    );
    if (!r.ok) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
  }

  return NextResponse.json({ ok: true });
}
