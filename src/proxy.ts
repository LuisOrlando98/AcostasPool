import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, ROLE_REDIRECTS, type UserRole } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/jwt";

/**
 * Request-level route protection (Next.js 16 "proxy", formerly middleware).
 *
 * It runs on the Node.js runtime before any page or layout renders and only
 * inspects the session cookie: it never touches the database. The server
 * guards in `@/lib/auth/guards` remain the source of truth (active user,
 * developer access, role stored in the database); this layer only adds an
 * early redirect that preserves the requested path in `?next=`.
 */

type ProtectedRoute = {
  readonly prefix: string;
  readonly role: UserRole;
};

const PROTECTED_ROUTES: readonly ProtectedRoute[] = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/tech", role: "TECH" },
  { prefix: "/client", role: "CUSTOMER" },
];

const LOGIN_PATH = "/login";
const UNAUTHORIZED_PATH = "/unauthorized";
const HOME_PATH = "/";
const NEXT_QUERY_PARAM = "next";

function redirectWithNext(request: NextRequest, target: string, next: string) {
  const url = new URL(target, request.url);
  url.searchParams.set(NEXT_QUERY_PARAM, next);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const route = PROTECTED_ROUTES.find((candidate) =>
    pathname.startsWith(candidate.prefix)
  );

  if (!route) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return redirectWithNext(request, LOGIN_PATH, pathname);
  }

  if (session.role !== route.role) {
    const fallback = ROLE_REDIRECTS[session.role] ?? HOME_PATH;
    return redirectWithNext(request, UNAUTHORIZED_PATH, fallback);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/tech/:path*", "/client/:path*"],
};
