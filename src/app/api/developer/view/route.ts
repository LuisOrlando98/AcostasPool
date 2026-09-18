import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, ROLE_REDIRECTS, type UserRole } from "@/lib/auth/config";
import {
  DEV_VIEW_COOKIE_MAX_AGE,
  DEV_VIEW_COOKIE_NAME,
  DEV_VIEW_COOKIE_OPTIONS,
  DEV_VIEW_ERROR_CODES,
  DEV_VIEW_ROLES,
  buildDeveloperSessionCookie,
  resolveDeveloperActor,
  serializeDevViewCookie,
  type DevViewActor,
  type DevViewRole,
} from "@/lib/auth/dev-view";
import {
  ensureDeveloperCustomer,
  ensureDeveloperTechnician,
} from "@/lib/auth/dev-view-records";
import { logAuditEvent } from "@/lib/audit/log";

export const runtime = "nodejs";

/** Acción registrada en AuditLog cada vez que se cambia de vista. */
const DEV_VIEW_AUDIT_ACTION = "DEV_VIEW_SWITCH";
const DEV_VIEW_AUDIT_ENTITY = "User";

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL_ERROR = 500;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/** Mismas opciones que usa el login para `ap_session`. */
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  priority: "high",
  path: "/",
} as const;

const switchViewSchema = z.object({
  role: z.enum(["ADMIN", ...DEV_VIEW_ROLES]),
});

function errorResponse(message: string, code: string, status: number) {
  return NextResponse.json(
    { error: message, code },
    { status, headers: NO_STORE_HEADERS }
  );
}

function successResponse(role: UserRole) {
  return NextResponse.json(
    { ok: true, role, redirectTo: ROLE_REDIRECTS[role] },
    { headers: NO_STORE_HEADERS }
  );
}

async function recordSwitch(actor: DevViewActor, role: UserRole) {
  await logAuditEvent({
    userId: actor.id,
    actorEmail: actor.email,
    actorName: actor.fullName,
    action: DEV_VIEW_AUDIT_ACTION,
    entity: DEV_VIEW_AUDIT_ENTITY,
    entityId: actor.id,
    metadata: { role },
  });
}

/**
 * Crea (idempotente) la fila de pruebas que necesita la vista elegida, para que
 * las páginas de técnico o cliente encuentren datos del propio desarrollador.
 */
async function ensureRecordsFor(role: DevViewRole, actorId: string) {
  if (role === "TECH") {
    await ensureDeveloperTechnician(actorId);
    return;
  }
  await ensureDeveloperCustomer(actorId);
}

/**
 * Cambia la vista activa del desarrollador.
 *
 * El actor se resuelve SIEMPRE desde la cookie de sesión y la base de datos, no
 * desde `getSession()`: mientras la vista está activa `getSession()` devuelve el
 * rol emulado y permitiría escalar desde una vista de técnico o cliente.
 *
 * Además se vuelve a firmar `ap_session` con el claim `dev: true`. Sin él,
 * `src/proxy.ts` (que no consulta la base de datos) redirige a `/unauthorized`
 * al entrar en `/tech` o `/client` con un token emitido antes del claim.
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const actor = await resolveDeveloperActor(authToken);
    if (!actor) {
      return errorResponse(
        "Acceso restringido a cuentas de desarrollador.",
        DEV_VIEW_ERROR_CODES.notDeveloper,
        HTTP_FORBIDDEN
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = switchViewSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "Solicitud invalida.",
        DEV_VIEW_ERROR_CODES.invalidRequest,
        HTTP_BAD_REQUEST
      );
    }

    const { role } = parsed.data;
    if (role !== "ADMIN") {
      await ensureRecordsFor(role, actor.id);
    }

    const session = await buildDeveloperSessionCookie(actor, authToken);
    const response = successResponse(role);
    response.cookies.set(AUTH_COOKIE_NAME, session.token, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: session.maxAge,
    });
    response.cookies.set(
      DEV_VIEW_COOKIE_NAME,
      role === "ADMIN" ? "" : serializeDevViewCookie({ role, sid: session.sid }),
      {
        ...DEV_VIEW_COOKIE_OPTIONS,
        maxAge: role === "ADMIN" ? 0 : DEV_VIEW_COOKIE_MAX_AGE,
      }
    );
    await recordSwitch(actor, role);
    return response;
  } catch (error) {
    console.error("Developer view switch failed:", error);
    return errorResponse(
      "No se pudo cambiar de vista.",
      DEV_VIEW_ERROR_CODES.switchFailed,
      HTTP_INTERNAL_ERROR
    );
  }
}
