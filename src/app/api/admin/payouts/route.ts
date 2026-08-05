import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformAdmin } from "@/lib/api-auth";
import { isSameOrigin } from "@/lib/http";
import { recordPayout } from "@/services/settlement.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  organizerId: z.string().uuid(),
  currency: z.string().trim().length(3),
  // Amount entered in major units (e.g. dollars); stored as minor units.
  amountMajor: z.number().positive(),
  note: z.string().trim().optional(),
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

  const result = await recordPayout(
    {
      organizerId: parsed.data.organizerId,
      currency: parsed.data.currency,
      amountMinor: Math.round(parsed.data.amountMajor * 100),
      note: parsed.data.note ?? null,
    },
    staff.id,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
