import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Edge middleware only performs a cheap cookie-presence check to redirect
 * obviously-unauthenticated users. It must NOT touch the database (TypeORM is
 * Node-only). Real authorization happens in the admin server layout.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  const guarded: Array<{ prefix: string; login: string }> = [
    { prefix: "/admin", login: "/admin/login" },
    { prefix: "/check-in", login: "/check-in/login" },
  ];

  for (const { prefix, login } of guarded) {
    if (
      pathname.startsWith(prefix) &&
      pathname !== login &&
      !hasSession
    ) {
      const url = request.nextUrl.clone();
      url.pathname = login;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/check-in/:path*"],
};
