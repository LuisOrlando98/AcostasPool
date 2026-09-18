import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  signSessionToken,
  verifySessionToken,
  type VerifiedSessionPayload,
} from "@/lib/auth/jwt";
import { isDeveloperAccount, isDeveloperEmail } from "@/lib/auth/developer";
import { AUTH_COOKIE_MAX_AGE } from "@/lib/auth/config";

/**
 * Vista de desarrollador ("ver como").
 *
 * Una cuenta de desarrollador puede mirar la aplicación con los ojos de un
 * técnico o de un cliente sin cerrar sesión y SIN usar credenciales ajenas: la
 * sesión sigue siendo la suya (`session.sub` = su id) y solo cambia el `role`.
 * Las páginas de técnico y cliente encuentran sus datos porque el desarrollador
 * tiene sus propias filas `Technician` / `Customer` de pruebas
 * (`@/lib/auth/dev-view-records`).
 *
 * La cookie `ap_dev_view` guarda únicamente el rol elegido; la sesión real
 * (`ap_session`) solo se reescribe para añadirle el claim `dev`, así que
 * revocar la vista es tan simple como borrar esta cookie.
 *
 * Este módulo no importa `next/headers`: los llamadores le pasan el valor
 * crudo de las cookies. Así las funciones puras (`parseDevViewCookie`,
 * `serializeDevViewCookie`) se pueden probar sin entorno de Next.
 */

export const DEV_VIEW_COOKIE_NAME = "ap_dev_view";

const SECONDS_PER_HOUR = 60 * 60;
const DEV_VIEW_COOKIE_HOURS = 12;
const MILLISECONDS_PER_SECOND = 1000;
/** Colchón mínimo del token re-firmado cuando al anterior le queda muy poco. */
const MIN_SESSION_COOKIE_MAX_AGE = 60;

export const DEV_VIEW_COOKIE_MAX_AGE = DEV_VIEW_COOKIE_HOURS * SECONDS_PER_HOUR;
export const DEV_VIEW_COOKIE_PATH = "/";

/** Opciones de `cookies().set` compartidas por escritura y borrado. */
export const DEV_VIEW_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: DEV_VIEW_COOKIE_PATH,
} as const;

/**
 * Códigos de error de `POST /api/developer/view`. Viajan en el cuerpo de la
 * respuesta para que el conmutador elija el mensaje traducido (en particular
 * "tu cuenta no está marcada como desarrollador") en vez de uno genérico.
 */
export const DEV_VIEW_ERROR_CODES = {
  invalidRequest: "INVALID_REQUEST",
  notDeveloper: "NOT_DEVELOPER",
  switchFailed: "SWITCH_FAILED",
} as const;

/** Roles que se pueden emular. ADMIN no se emula: es la vista real. */
export const DEV_VIEW_ROLES = ["TECH", "CUSTOMER"] as const;
export type DevViewRole = (typeof DEV_VIEW_ROLES)[number];

const devViewCookieSchema = z.object({
  role: z.enum(DEV_VIEW_ROLES),
});

export type DevViewCookieValue = z.infer<typeof devViewCookieSchema>;

/** Base64url: el valor viaja en una cookie sin caracteres que haya que escapar. */
const COOKIE_ENCODING = "base64url";
const JSON_ENCODING = "utf8";

export function serializeDevViewCookie(value: DevViewCookieValue): string {
  const payload = JSON.stringify({ role: value.role });
  return Buffer.from(payload, JSON_ENCODING).toString(COOKIE_ENCODING);
}

/** Devuelve `null` ante cualquier cookie ausente, corrupta o con forma inesperada. */
export function parseDevViewCookie(raw?: string | null): DevViewCookieValue | null {
  if (!raw) {
    return null;
  }
  try {
    const json = Buffer.from(raw, COOKIE_ENCODING).toString(JSON_ENCODING);
    const parsed = devViewCookieSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type DeveloperCandidate = {
  id: string;
  email: string;
  isDeveloper?: boolean | null;
};

/**
 * Acceso de desarrollador: la marca `User.isDeveloper` sobre un correo de la
 * lista, o el correo de la lista por sí solo (mismo criterio que `getSession`
 * y que `POST /api/developer/view`).
 */
export function hasDeveloperAccess(user: {
  email: string;
  isDeveloper?: boolean | null;
}): boolean {
  return isDeveloperAccount(user) || isDeveloperEmail(user.email);
}

export type DevViewActor = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
};

/**
 * Resuelve el usuario REAL a partir del JWT de sesión y confirma que es
 * desarrollador. Se usa en `/api/developer/view` para no confiar en
 * `getSession()`, que mientras la vista está activa devuelve el rol emulado.
 */
export async function resolveDeveloperActor(
  authToken?: string | null
): Promise<DevViewActor | null> {
  if (!authToken) {
    return null;
  }
  const payload = await verifySessionToken(authToken);
  if (!payload?.sub) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      isActive: true,
      isDeveloper: true,
    },
  });
  if (!user || !user.isActive || !hasDeveloperAccess(user)) {
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
  };
}

export type ResolvedDevView = {
  role: DevViewRole;
};

type ResolveDevViewInput = {
  actor: DeveloperCandidate;
  cookieValue: DevViewCookieValue | null;
};

/**
 * Confirma que el desarrollador puede ver la app con el rol pedido: además de
 * tener acceso de desarrollador, necesita su propia fila `Technician` o
 * `Customer` (la que crea `@/lib/auth/dev-view-records` al cambiar de vista),
 * porque es la que buscan por `userId` las páginas de esa vista. Cualquier
 * fallo devuelve `null` y la sesión cae de vuelta a la vista de administrador.
 */
export async function resolveDevView({
  actor,
  cookieValue,
}: ResolveDevViewInput): Promise<ResolvedDevView | null> {
  if (!cookieValue || !hasDeveloperAccess(actor)) {
    return null;
  }

  if (cookieValue.role === "TECH") {
    const technician = await prisma.technician.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    return technician ? { role: "TECH" } : null;
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });
  return customer ? { role: "CUSTOMER" } : null;
}

export type DeveloperSessionCookie = {
  readonly token: string;
  readonly maxAge: number;
};

function nowInSeconds(): number {
  return Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
}

/**
 * Vida restante del token anterior, para no alargar la sesión al re-firmarla.
 * Sin `exp` utilizable (token antiguo o ya caducado) se usa la vida estándar.
 */
function resolveMaxAge(previous: VerifiedSessionPayload | null): number {
  const remaining = previous?.exp ? previous.exp - nowInSeconds() : 0;
  if (remaining <= MIN_SESSION_COOKIE_MAX_AGE) {
    return AUTH_COOKIE_MAX_AGE;
  }
  return Math.min(remaining, AUTH_COOKIE_MAX_AGE);
}

/**
 * Vuelve a firmar la sesión del desarrollador con el claim `dev: true`.
 *
 * Los tokens emitidos antes de que existiera el claim hacen que `src/proxy.ts`
 * (que no consulta la base de datos) redirija a `/unauthorized` al entrar en
 * `/tech` o `/client`. Al cambiar de vista se re-firma el token, con el mismo
 * `exp` que tenía, para que no haga falta volver a iniciar sesión.
 */
export async function buildDeveloperSessionCookie(
  actor: DevViewActor,
  authToken?: string | null
): Promise<DeveloperSessionCookie> {
  const previous = authToken ? await verifySessionToken(authToken) : null;
  const expiresAt = previous?.exp;
  const token = await signSessionToken(
    {
      sub: actor.id,
      email: actor.email,
      name: actor.fullName,
      // El JWT de un desarrollador guarda siempre ADMIN (igual que en el
      // login): el rol emulado vive en `ap_dev_view`, no en la sesión.
      role: "ADMIN",
      avatarUrl: actor.avatarUrl,
      dev: true,
    },
    expiresAt ? { expiresAt } : {}
  );
  return { token, maxAge: resolveMaxAge(previous) };
}
