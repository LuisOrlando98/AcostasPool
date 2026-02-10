import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, ROLE_REDIRECTS, type UserRole } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/jwt";

const protectedRoutes = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/tech", role: "TECH" },
  { prefix: "/client", role: "CUSTOMER" },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const routeMatch = protectedRoutes.find((route) =>
    pathname.startsWith(route.prefix)
  );

  if (!routeMatch) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifySessionToken(token);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role !== routeMatch.role) {
    const fallback = ROLE_REDIRECTS[session.role as UserRole] ?? "/";
    const unauthorizedUrl = new URL("/unauthorized", request.url);
    unauthorizedUrl.searchParams.set("next", fallback);
    return NextResponse.redirect(unauthorizedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/tech/:path*", "/client/:path*"],
};
