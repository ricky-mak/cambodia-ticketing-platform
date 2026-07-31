import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminStaff } from "@/lib/api-auth";
import { isSameOrigin } from "@/lib/http";
import { fromDateTimeLocal } from "@/lib/datetime";
import { createEvent, updateEvent } from "@/services/event.service";
import { writeAudit } from "@/services/audit.service";
import { AuditAction } from "@/types/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const nullableString = z.string().trim().optional().nullable();

const bodySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug may contain lowercase letters, numbers, hyphens"),
  description: nullableString,
  venueName: nullableString,
  venueAddress: nullableString,
  heroImageUrl: nullableString,
  contactEmail: z.string().trim().email().optional().nullable().or(z.literal("")),
  contactPhone: nullableString,
  refundPolicy: nullableString,
  terms: nullableString,
  startsAt: nullableString,
  endsAt: nullableString,
  salesStartAt: nullableString,
  salesEndAt: nullableString,
  currency: z.string().trim().length(3).optional(),
  reservationMinutes: z.number().int().min(1).max(240).optional(),
});

export async function POST(request: Request) {
  const staff = await getAdminStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const input = {
    name: d.name,
    slug: d.slug,
    description: d.description ?? null,
    venueName: d.venueName ?? null,
    venueAddress: d.venueAddress ?? null,
    heroImageUrl: d.heroImageUrl ?? null,
    contactEmail: d.contactEmail ? d.contactEmail : null,
    contactPhone: d.contactPhone ?? null,
    refundPolicy: d.refundPolicy ?? null,
    terms: d.terms ?? null,
    startsAt: fromDateTimeLocal(d.startsAt),
    endsAt: fromDateTimeLocal(d.endsAt),
    salesStartAt: fromDateTimeLocal(d.salesStartAt),
    salesEndAt: fromDateTimeLocal(d.salesEndAt),
    currency: d.currency ?? "USD",
    reservationMinutes: d.reservationMinutes,
  };

  try {
    const event = d.id
      ? await updateEvent(d.id, input)
      : await createEvent(input);

    await writeAudit({
      staffUserId: staff.id,
      action: d.id ? AuditAction.EVENT_UPDATED : AuditAction.EVENT_CREATED,
      entityType: "event",
      entityId: event.id,
    });

    return NextResponse.json({ ok: true, id: event.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    // Unique-slug violation surfaces here.
    const status = /duplicate|unique/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
