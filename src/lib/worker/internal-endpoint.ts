import type { EnvSource } from "@/lib/config/env";
import type { WorkerLogger } from "@/lib/worker/logger";
import { asRecord, readString } from "@/lib/worker/payload";

/**
 * POST a un endpoint interno de la web protegido por el secreto compartido de cron.
 * Todas las tareas del worker que delegan trabajo en la web (optimización de rutas,
 * regeneración de contratos, conciliación de Stripe) pasan por aquí.
 */

export const CRON_SECRET_HEADER = "x-cron-secret";
const LOCATION_HEADER = "location";
const TRAILING_SLASHES = /\/+$/;
const REDIRECT_STATUS_MIN = 300;
const REDIRECT_STATUS_MAX = 399;
/** Marca de "cuerpo no JSON": estos endpoints siempre responden JSON, así que otra cosa es un error. */
const INVALID_JSON = Symbol("invalid-json");

export type InternalEndpointDeps = {
  readonly env: EnvSource;
  readonly logger: WorkerLogger;
  readonly fetchImpl: typeof fetch;
};

export type InternalEndpointCall = {
  /** Ruta del endpoint, relativa a APP_URL y empezando por "/". */
  readonly path: string;
  /** Texto con el que se registran tanto el resultado como la omisión por falta de configuración. */
  readonly label: string;
  readonly timeoutMs: number;
};

export type InternalEndpointSummary = {
  readonly requested: number;
  readonly skipped: number;
};

function isRedirect(status: number): boolean {
  return status >= REDIRECT_STATUS_MIN && status <= REDIRECT_STATUS_MAX;
}

function describeFailure(data: unknown, status: number): string {
  return readString(asRecord(data), "error") ?? `HTTP ${status}`;
}

export async function callInternalEndpoint(
  deps: InternalEndpointDeps,
  call: InternalEndpointCall
): Promise<InternalEndpointSummary> {
  const { env, logger, fetchImpl } = deps;
  const appUrl = (env.APP_URL ?? "").trim().replace(TRAILING_SLASHES, "");
  const secret = (env.CRON_SECRET ?? "").trim();
  if (!appUrl || !secret) {
    logger.warn(`${call.label} skipped: missing APP_URL or CRON_SECRET`);
    return { requested: 0, skipped: 1 };
  }

  const response = await fetchImpl(`${appUrl}${call.path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [CRON_SECRET_HEADER]: secret },
    body: JSON.stringify({}),
    // Una redirección (p. ej. a /login) significa que no se está hablando con el endpoint.
    redirect: "manual",
    signal: AbortSignal.timeout(call.timeoutMs),
  });
  if (isRedirect(response.status)) {
    const location = response.headers.get(LOCATION_HEADER) ?? "unknown";
    throw new Error(`unexpected redirect (HTTP ${response.status}) to ${location}`);
  }
  const data: unknown = await response.json().catch(() => INVALID_JSON);
  if (!response.ok) {
    throw new Error(describeFailure(data, response.status));
  }
  if (data === INVALID_JSON) {
    throw new Error(`invalid JSON response (HTTP ${response.status})`);
  }
  logger.info(call.label, { response: data });
  return { requested: 1, skipped: 0 };
}
