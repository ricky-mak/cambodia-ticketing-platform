import { NextResponse } from "next/server";
import { logout } from "@/services/auth.service";
import { clearSessionCookie } from "@/lib/session";
import { isSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Bad origin" }, { status: 403 });
  }

  await logout();
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
