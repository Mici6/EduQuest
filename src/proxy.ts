import { NextResponse, type NextRequest } from "next/server";
import { allowedRoles, homeFor } from "@/lib/auth/routes";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

/**
 * Early, coarse access control for /app: unauthenticated users go to sign-in
 * and users on another role's section are redirected to their own home.
 * This is a convenience layer — pages and domain functions re-check access.
 */
export function proxy(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const roles = allowedRoles(request.nextUrl.pathname);
  if (roles && !roles.includes(session.role)) {
    return NextResponse.redirect(new URL(`${homeFor(session.role)}?denied=1`, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
