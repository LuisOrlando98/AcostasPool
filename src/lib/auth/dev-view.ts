import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";
import { verifySessionToken } from "@/lib/auth/jwt";
import { isDeveloperAccount, isDeveloperEmail } from "@/lib/auth/developer";

/**
 * Vista de desarrollador ("ver como").
 *
 * Una cuenta de desarrollador puede mirar la aplicación con los ojos de un
 * técnico o de un cliente sin cerrar sesión. La cookie `ap_dev_view` guarda
 * únicamente el rol elegido y el id del usuario objetivo; la sesión real
 * (`ap_session`) no cambia nunca, así que revocar la vista es tan simple como
 * borrar esta cookie.
 *
 * Este módulo no importa `next/headers`: los llamadores le pasan el valor
 * crudo de las cookies. Así las funciones puras (`parseDevViewCookie`,
 * `serializeDevViewCookie`) se pueden probar sin entorno de Next.
 */

export const DEV_VIEW_COOKIE_NAME = "ap_dev_view";

const SECONDS_PER_HOUR = 60 * 60;
const DEV_VIEW_COOKIE_HOURS = 12;

export const DEV_VIEW_COOKIE_MAX_AGE = DEV_VIEW_COOKIE_HOURS * SECONDS_PER_HOUR;
export const DEV_VIEW_COOKIE_PATH = "/";

/** Opciones de `cookies().set` compartidas por escritura y borrado. */
export const DEV_VIEW_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: DEV_VIEW_COOKIE_PATH,
} as const;

/** Roles que se pueden emular. ADMIN no se emula: es la vista real. */
export const DEV_VIEW_ROLES = ["TECH", "CUSTOMER"] as const;
export type DevViewRole = (typeof DEV_VIEW_ROLES)[number];

const devViewCookieSchema = z.object({
  role: z.enum(DEV_VIEW_ROLES),
  targetUserId: z.string().min(1),
});

export type DevViewCookieValue = z.infer<typeof devViewCookieSchema>;

/** Base64url: el valor viaja en una cookie sin caracteres que haya que escapar. */
const COOKIE_ENCODING = "base64url";
const JSON_ENCODING = "utf8";

export function serializeDevViewCookie(value: DevViewCookieValue): string {
  const payload = JSON.stringify({
    role: value.role,
    targetUserId: value.targetUserId,
  });
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
  email: string;
  isDeveloper?: boolean | null;
};

/**
 * Acceso de desarrollador: la marca `User.isDeveloper` sobre un correo de la
 * lista, o el correo de la lista por sí solo (mismo criterio que `getSession`).
 */
export function hasDeveloperAccess(user: DeveloperCandidate): boolean {
  return isDeveloperAccount(user) || isDeveloperEmail(user.email);
}

export type DevViewActor = {
  id: string;
  email: string;
  fullName: string;
};

/**
 * Resuelve el usuario REAL a partir del JWT de sesión y confirma que es
 * desarrollador. Se usa en las rutas `/api/developer/view*` para no confiar en
 * `getSession()`, que mientras la vista está activa devuelve el usuario
 * impersonado.
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
      isActive: true,
      isDeveloper: true,
    },
  });
  if (!user || !user.isActive || !hasDeveloperAccess(user)) {
    return null;
  }
  return { id: user.id, email: user.email, fullName: user.fullName };
}

export type DevViewTargetUser = {
  id: string;
  email: string;
  fullName: string;
  role: DevViewRole;
  avatarUrl: string | null;
};

export type ResolvedDevView = {
  targetUser: DevViewTargetUser;
  label: string;
};

type ResolveDevViewInput = {
  actor: DeveloperCandidate;
  cookieValue: DevViewCookieValue | null;
};

const TARGET_SELECT = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  technician: { select: { id: true } },
  customer: { select: { nombre: true, apellidos: true, email: true } },
} as const;

type TargetRow = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  technician: { id: string } | null;
  customer: { nombre: string; apellidos: string; email: string } | null;
};

function toTargetUser(row: TargetRow, role: DevViewRole): DevViewTargetUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role,
    avatarUrl: row.avatarUrl,
  };
}

function technicianLabel(row: TargetRow): string {
  return row.fullName.trim() || row.email;
}

/**
 * Carga el usuario objetivo de la cookie y comprueba que sigue siendo válido:
 * activo, con el rol pedido y con la fila Technician/Customer que las páginas
 * de esa vista buscan por `userId`. Cualquier fallo devuelve `null`, de modo
 * que la sesión cae de vuelta a la vista de administrador.
 */
export async function resolveDevView({
  actor,
  cookieValue,
}: ResolveDevViewInput): Promise<ResolvedDevView | null> {
  if (!cookieValue || !hasDeveloperAccess(actor)) {
    return null;
  }

  const row = await prisma.user.findFirst({
    where: {
      id: cookieValue.targetUserId,
      isActive: true,
      role: cookieValue.role,
    },
    select: TARGET_SELECT,
  });
  if (!row) {
    return null;
  }

  if (cookieValue.role === "TECH") {
    if (!row.technician) {
      return null;
    }
    return { targetUser: toTargetUser(row, "TECH"), label: technicianLabel(row) };
  }

  if (!row.customer) {
    return null;
  }
  return {
    targetUser: toTargetUser(row, "CUSTOMER"),
    label: formatCustomerName(row.customer),
  };
}

export type DevViewTargetOption = {
  userId: string;
  label: string;
};

export type DevViewTargets = {
  technicians: DevViewTargetOption[];
  customers: DevViewTargetOption[];
  /** Objetivo preseleccionado por rol: el propio desarrollador si lo es, si no el primero. */
  defaults: Record<DevViewRole, string | null>;
};

function pickDefault(
  options: readonly DevViewTargetOption[],
  actorUserId: string
): string | null {
  const own = options.find((option) => option.userId === actorUserId);
  return own?.userId ?? options[0]?.userId ?? null;
}

/** Usuarios activos que se pueden emular, ya etiquetados para el selector. */
export async function listDevViewTargets(
  actorUserId: string
): Promise<DevViewTargets> {
  const [technicianRows, customerRows] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: "TECH", technician: { isNot: null } },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: "CUSTOMER", customer: { isNot: null } },
      select: {
        id: true,
        fullName: true,
        email: true,
        customer: { select: { nombre: true, apellidos: true, email: true } },
      },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const technicians = technicianRows.map((row) => ({
    userId: row.id,
    label: row.fullName.trim() || row.email,
  }));
  const customers = customerRows.map((row) => ({
    userId: row.id,
    label: row.customer
      ? formatCustomerName(row.customer)
      : row.fullName.trim() || row.email,
  }));

  return {
    technicians,
    customers,
    defaults: {
      TECH: pickDefault(technicians, actorUserId),
      CUSTOMER: pickDefault(customers, actorUserId),
    },
  };
}
