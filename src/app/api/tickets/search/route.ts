import { NextResponse } from "next/server";
import { getCheckInStaff } from "@/lib/api-auth";
import { searchTickets } from "@/services/check-in.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const staff = await getCheckInStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchTickets(q, staff.organizerId);
  return NextResponse.json({ results });
}
