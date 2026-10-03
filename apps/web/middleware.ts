import { NextRequest, NextResponse } from "next/server";

/**
 * UX-only guard: arahkan berdasarkan keberadaan cookie sesi.
 * Otorisasi sesungguhnya tetap ditegakkan backend per endpoint.
 */
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "school_report_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(COOKIE_NAME);

  if (pathname === "/login") {
    if (hasSession) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }
  if (!hasSession) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico).*)"],
};
