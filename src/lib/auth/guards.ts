import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ROLE_REDIRECTS, type UserRole } from "@/lib/auth/config";

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(role: UserRole) {
  const session = await requireAuth();
  if (session.role !== role) {
    const fallback = ROLE_REDIRECTS[session.role] ?? "/";
    redirect(`/unauthorized?next=${fallback}`);
  }
  return session;
}
