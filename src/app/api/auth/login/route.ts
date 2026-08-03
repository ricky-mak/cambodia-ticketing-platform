import { NextResponse } from "next/server";
import { z } from "zod";
import { login } from "@/services/auth.service";
import { setSessionCookie } from "@/lib/session";
import { isSameOrigin, clientIp } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "login", 10, 5 * 60_000);
  if (limited) return limited;

  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Bad origin" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid credentials format" },
      { status: 400 },
    );
  }

  const result = await login({
    email: parsed.data.email,
    password: parsed.data.password,
    userAgent: request.headers.get("user-agent"),
    ipAddress: clientIp(request),
  });

  if (!result.ok) {
    // Generic message — do not reveal whether the email exists.
    return NextResponse.json(
      { ok: false, error: "Invalid email or password" },
      { status: 401 },
    );
  }

  await setSessionCookie(result.token);
  return NextResponse.json({ ok: true, role: result.staff.role });
}
