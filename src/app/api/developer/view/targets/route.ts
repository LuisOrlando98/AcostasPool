import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/config";
import { listDevViewTargets, resolveDeveloperActor } from "@/lib/auth/dev-view";

export const runtime = "nodejs";

const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL_ERROR = 500;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * Objetivos que una cuenta de desarrollador puede emular: usuarios activos con
 * fila Technician / Customer enlazada por `userId`. Devuelve además el objetivo
 * preseleccionado por rol.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const actor = await resolveDeveloperActor(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    if (!actor) {
      return NextResponse.json(
        { error: "Acceso restringido a cuentas de desarrollador." },
        { status: HTTP_FORBIDDEN, headers: NO_STORE_HEADERS }
      );
    }

    const targets = await listDevViewTargets(actor.id);
    return NextResponse.json(targets, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Developer view targets failed:", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los objetivos." },
      { status: HTTP_INTERNAL_ERROR, headers: NO_STORE_HEADERS }
    );
  }
}
