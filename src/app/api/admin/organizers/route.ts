import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformAdmin } from "@/lib/api-auth";
import { isSameOrigin } from "@/lib/http";
import { createOrganizerWithAdmin } from "@/services/organizer.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  payoutNotes: z.string().trim().optional(),
  adminName: z.string().trim().min(1),
  adminEmail: z.string().trim().email(),
  adminPassword: z.string().min(12),
});

export async function POST(request: Request) {
  const staff = await getPlatformAdmin();
  if (!staff) {
    return NextResponse.json({ error: "Platform admins only" }, { status: 403 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const result = await createOrganizerWithAdmin(
    {
      name: parsed.data.name,
      slug: parsed.data.slug,
      contactEmail: parsed.data.contactEmail || null,
      payoutNotes: parsed.data.payoutNotes || null,
      adminName: parsed.data.adminName,
      adminEmail: parsed.data.adminEmail,
      adminPassword: parsed.data.adminPassword,
    },
    staff.id,
  );

  const status = result.ok
    ? 200
    : result.reason === "invalid_slug" || result.reason === "password_too_short"
      ? 400
      : 409;
  return NextResponse.json(result, { status });
}
