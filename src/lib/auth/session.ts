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

/** Vista de desarrollador activa: el rol con el que se está mirando la app. */
export type SessionDevView = {
  role: DevViewRole;
};

export type Session = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  isDeveloper: boolean;
  /** `null` salvo que un desarrollador esté mirando la app con otro rol. */
  devView: SessionDevView | null;
};

/**
 * Sesión efectiva de la petición.
 *
 * Un desarrollador ve siempre ADMIN, salvo que la cookie `ap_dev_view` pida
 * otro rol: en ese caso la sesión devuelta sigue siendo LA SUYA (`sub`, `email`,
 * `name`, `avatarUrl`) y solo cambia `role`, así que las páginas de técnico y
 * cliente encuentran sus filas de pruebas por `userId = session.sub`. Las
 * cuentas que no son de desarrollador ignoran la cookie por completo.
 *
 * El acceso de desarrollador se concede tanto por la marca `isDeveloper` sobre
 * un correo de la lista como por el correo de la lista por sí solo, que es el
 * mismo criterio que aplica `POST /api/developer/view`.
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

  return {
    sub: user.id,
    email: user.email,
    name: user.fullName,
    role: devView?.role ?? "ADMIN",
    avatarUrl: user.avatarUrl,
    isDeveloper: true,
    devView: devView ? { role: devView.role } : null,
  };
}
