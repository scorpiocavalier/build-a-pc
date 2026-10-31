import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";

const intl = createIntlMiddleware(routing);

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // Optimistic check only: send visitors without a session cookie straight
    // to sign-in. Pages and actions still call requireAdmin().
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!hasSession && pathname !== "/admin/sign-in") {
      return NextResponse.redirect(new URL("/admin/sign-in", request.url));
    }
    return NextResponse.next();
  }

  return intl(request);
}

export const config = {
  // Skip API routes, Next internals and any path with a file extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
