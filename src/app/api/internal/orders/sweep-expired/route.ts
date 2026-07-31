import { NextResponse } from "next/server";
import { assertInternalRequest } from "@/lib/internal-auth";
import { releaseExpiredHolds } from "@/services/order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!assertInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await releaseExpiredHolds();
  return NextResponse.json({ ok: true, ...result });
}
