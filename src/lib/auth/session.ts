import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, type UserRole } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";
import {
  DEV_VIEW_COOKIE_NAME,
  hasDeveloperAccess,
  parseDevViewCookie,
  resolveDevView,
  type DevViewRole,
} from "@/lib/auth/dev-view";

/** Vista de desarrollador activa: quién mira (actor) y a quién ve (target). */
export type SessionDevView = {
  actorUserId: string;
  actorEmail: string;
  actorName: string;
  role: DevViewRole;
  targetLabel: string;
};

export type Session = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  isDeveloper: boolean;
  /** `null` salvo que un desarrollador esté viendo la app como otro usuario. */
  devView: SessionDevView | null;
};

/**
 * Sesión efectiva de la petición.
 *
 * Un desarrollador ve siempre ADMIN, salvo que la cookie `ap_dev_view` apunte a
 * un objetivo válido: en ese caso la sesión devuelta ES la del usuario objetivo
 * (`sub`, `email`, `name`, `role`, `avatarUrl`), de modo que las páginas de
 * técnico y cliente encuentran su fila por `userId = session.sub` sin cambios.
 * Las cuentas que no son de desarrollador ignoran la cookie por completo.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!cookie) {
    return null;
  }
  const tokenPayload = await verifySessionToken(cookie);
  if (!tokenPayload?.sub) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenPayload.sub },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      avatarUrl: true,
      isActive: true,
      isDeveloper: true,
    },
  });
  if (!user || !user.isActive) {
    return null;
  }

  const developerAccess = hasDeveloperAccess(user);
  if (!developerAccess) {
    return {
      sub: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isDeveloper: false,
      devView: null,
    };
  }

  const devView = await resolveDevView({
    actor: user,
    cookieValue: parseDevViewCookie(cookieStore.get(DEV_VIEW_COOKIE_NAME)?.value),
  });
  if (!devView) {
    return {
      sub: user.id,
      email: user.email,
      name: user.fullName,
      role: "ADMIN",
      avatarUrl: user.avatarUrl,
      isDeveloper: true,
      devView: null,
    };
  }

  return {
    sub: devView.targetUser.id,
    email: devView.targetUser.email,
    name: devView.targetUser.fullName,
    role: devView.targetUser.role,
    avatarUrl: devView.targetUser.avatarUrl,
    isDeveloper: true,
    devView: {
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.fullName,
      role: devView.targetUser.role,
      targetLabel: devView.label,
    },
  };
}
