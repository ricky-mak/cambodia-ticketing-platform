import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
    },
  });
}
