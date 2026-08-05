import { NextResponse } from "next/server";
import { z } from "zod";
import { getCheckInStaff } from "@/lib/api-auth";
import { isSameOrigin } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { validateToken } from "@/services/check-in.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "ticket-validate", 600, 60_000);
  if (limited) return limited;

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

  const result = await validateToken(parsed.data.token, staff.organizerId);
  return NextResponse.json(result);
}
