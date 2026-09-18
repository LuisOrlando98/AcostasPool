import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, ROLE_REDIRECTS, type UserRole } from "@/lib/auth/config";
import {
  DEV_VIEW_COOKIE_MAX_AGE,
  DEV_VIEW_COOKIE_NAME,
  DEV_VIEW_COOKIE_OPTIONS,
  DEV_VIEW_ROLES,
  resolveDevView,
  resolveDeveloperActor,
  serializeDevViewCookie,
  type DevViewActor,
} from "@/lib/auth/dev-view";
import { logAuditEvent } from "@/lib/audit/log";

export const runtime = "nodejs";

/** Acción registrada en AuditLog cada vez que se cambia de vista. */
const DEV_VIEW_AUDIT_ACTION = "DEV_VIEW_SWITCH";
const DEV_VIEW_AUDIT_ENTITY = "User";

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL_ERROR = 500;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const switchViewSchema = z
  .object({
    role: z.enum(["ADMIN", ...DEV_VIEW_ROLES]),
    targetUserId: z.string().min(1).optional(),
  })
  .refine(
    (value) => value.role === "ADMIN" || Boolean(value.targetUserId),
    { message: "targetUserId is required for TECH and CUSTOMER views." }
  );

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
}

async function readActor(): Promise<DevViewActor | null> {
  const cookieStore = await cookies();
  return resolveDeveloperActor(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

function successResponse(role: UserRole) {
  return NextResponse.json(
    { ok: true, redirectTo: ROLE_REDIRECTS[role] },
    { headers: NO_STORE_HEADERS }
  );
}

async function recordSwitch(
  actor: DevViewActor,
  role: string,
  targetUserId: string | null
) {
  await logAuditEvent({
    userId: actor.id,
    actorEmail: actor.email,
    actorName: actor.fullName,
    action: DEV_VIEW_AUDIT_ACTION,
    entity: DEV_VIEW_AUDIT_ENTITY,
    entityId: targetUserId,
    metadata: { role, targetUserId },
  });
}

/**
 * Cambia la vista activa del desarrollador.
 *
 * El actor se resuelve SIEMPRE desde la cookie de sesión y la base de datos, no
 * desde `getSession()`: mientras la vista está activa `getSession()` devuelve el
 * usuario impersonado y permitiría escalar desde una vista de técnico o cliente.
 */
export async function POST(request: Request) {
  try {
    const actor = await readActor();
    if (!actor) {
      return errorResponse("Acceso restringido a cuentas de desarrollador.", HTTP_FORBIDDEN);
    }

    const body = await request.json().catch(() => null);
    const parsed = switchViewSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Solicitud invalida.", HTTP_BAD_REQUEST);
    }

    const { role } = parsed.data;

    if (role === "ADMIN") {
      const response = successResponse(role);
      response.cookies.set(DEV_VIEW_COOKIE_NAME, "", {
        ...DEV_VIEW_COOKIE_OPTIONS,
        maxAge: 0,
      });
      await recordSwitch(actor, role, null);
      return response;
    }

    const targetUserId = parsed.data.targetUserId ?? "";
    const resolved = await resolveDevView({
      actor,
      cookieValue: { role, targetUserId },
    });
    if (!resolved) {
      return errorResponse(
        "El usuario objetivo no existe, no esta activo o no tiene ese rol.",
        HTTP_BAD_REQUEST
      );
    }

    const response = successResponse(role);
    response.cookies.set(
      DEV_VIEW_COOKIE_NAME,
      serializeDevViewCookie({ role, targetUserId: resolved.targetUser.id }),
      { ...DEV_VIEW_COOKIE_OPTIONS, maxAge: DEV_VIEW_COOKIE_MAX_AGE }
    );
    await recordSwitch(actor, role, resolved.targetUser.id);
    return response;
  } catch (error) {
    console.error("Developer view switch failed:", error);
    return errorResponse("No se pudo cambiar de vista.", HTTP_INTERNAL_ERROR);
  }
}
