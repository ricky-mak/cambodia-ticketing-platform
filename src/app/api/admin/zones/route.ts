import { NextResponse } from "next/server";
import { z } from "zod";
import { getScopedAdminStaff } from "@/lib/api-auth";
import { inScope } from "@/lib/tenant";
import { isSameOrigin } from "@/lib/http";
import { createZone } from "@/services/zone.service";
import { getEventById } from "@/services/event.service";
import { writeAudit } from "@/services/audit.service";
import { AuditAction } from "@/types/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  // price entered in major units (e.g. dollars); converted to minor units below
  priceMajor: z.number().nonnegative(),
  currency: z.string().trim().length(3).optional(),
  maxPerOrder: z.number().int().positive().max(50).optional(),
  displayOrder: z.number().int().optional(),
  rows: z.number().int().positive().max(2000),
  seatsPerRow: z.number().int().positive().max(2000),
});

export async function POST(request: Request) {
  const gated = await getScopedAdminStaff();
  if (!gated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { staff, scope } = gated;
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = parsed.data;

  // Ownership: the target event must be in the caller's scope.
  const event = await getEventById(d.eventId);
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!inScope(scope, event.organizerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const zone = await createZone({
      eventId: d.eventId,
      name: d.name,
      description: d.description ?? null,
      priceMinor: Math.round(d.priceMajor * 100),
      currency: d.currency ?? "USD",
      maxPerOrder: d.maxPerOrder,
      displayOrder: d.displayOrder,
      rows: d.rows,
      seatsPerRow: d.seatsPerRow,
    });

    await writeAudit({
      staffUserId: staff.id,
      action: AuditAction.ZONE_CREATED,
      entityType: "zone",
      entityId: zone.id,
      newData: { name: zone.name, totalSeats: zone.totalSeats },
    });

    return NextResponse.json({
      ok: true,
      id: zone.id,
      totalSeats: zone.totalSeats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
