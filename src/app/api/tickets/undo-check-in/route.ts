import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminStaff } from "@/lib/api-auth";
import { isSameOrigin, clientIp } from "@/lib/http";
import { undoCheckIn } from "@/services/check-in.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ ticketId: z.string().uuid() });

// Undo is limited to admin-area roles (ADMIN / MANAGER).
export async function POST(request: Request) {
  const staff = await getAdminStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await undoCheckIn(
    parsed.data.ticketId,
    staff.id,
    {
      deviceInfo: request.headers.get("user-agent"),
      ipAddress: clientIp(request),
    },
    staff.organizerId,
  );
  return NextResponse.json(result);
}
