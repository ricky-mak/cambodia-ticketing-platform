import { NextResponse } from "next/server";
import { z } from "zod";
import { getCheckInStaff } from "@/lib/api-auth";
import { isSameOrigin, clientIp } from "@/lib/http";
import {
  checkInByToken,
  checkInByTicketId,
} from "@/services/check-in.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    token: z.string().min(1).optional(),
    ticketId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.token) || Boolean(d.ticketId), {
    message: "token or ticketId is required",
  });

export async function POST(request: Request) {
  const staff = await getCheckInStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const ctx = {
    deviceInfo: request.headers.get("user-agent"),
    ipAddress: clientIp(request),
  };

  const result = parsed.data.token
    ? await checkInByToken(parsed.data.token, staff.id, ctx)
    : await checkInByTicketId(parsed.data.ticketId!, staff.id, ctx);

  return NextResponse.json(result);
}
