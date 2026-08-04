import { NextResponse } from "next/server";
import { z } from "zod";
import { getScopedAdminStaff } from "@/lib/api-auth";
import { inScope } from "@/lib/tenant";
import { isSameOrigin } from "@/lib/http";
import { getEventById, setEventStatus } from "@/services/event.service";
import { writeAudit } from "@/services/audit.service";
import { AuditAction, EventStatus } from "@/types/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(EventStatus),
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
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const target = await getEventById(parsed.data.id);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!inScope(scope, target.organizerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const event = await setEventStatus(parsed.data.id, parsed.data.status);
    await writeAudit({
      staffUserId: staff.id,
      action: AuditAction.EVENT_STATUS_CHANGED,
      entityType: "event",
      entityId: event.id,
      newData: { status: event.status },
    });
    return NextResponse.json({ ok: true, status: event.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
