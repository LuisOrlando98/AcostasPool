import type { EnvSource } from "@/lib/config/env";
import { ROUTE_OPTIMIZE_TIMEOUT_MS } from "@/lib/worker/constants";
import type { WorkerLogger } from "@/lib/worker/logger";
import { asRecord, readString } from "@/lib/worker/payload";

/** Dispara la optimización diaria del asistente de rutas a través del endpoint interno de la web. */

export const AUTO_OPTIMIZE_PATH = "/api/internal/routes/assistant/auto-optimize";
export const CRON_SECRET_HEADER = "x-cron-secret";
const LOCATION_HEADER = "location";
const TRAILING_SLASHES = /\/+$/;
const REDIRECT_STATUS_MIN = 300;
const REDIRECT_STATUS_MAX = 399;
/** Marca de "cuerpo no JSON": el endpoint siempre responde JSON, así que otra cosa es un error. */
const INVALID_JSON = Symbol("invalid-json");

export type RouteOptimizeDeps = {
  readonly env: EnvSource;
  readonly logger: WorkerLogger;
  readonly fetchImpl: typeof fetch;
};

export type RouteOptimizeSummary = {
  readonly requested: number;
  readonly skipped: number;
};

function isRedirect(status: number): boolean {
  return status >= REDIRECT_STATUS_MIN && status <= REDIRECT_STATUS_MAX;
}

function describeFailure(data: unknown, status: number): string {
  return readString(asRecord(data), "error") ?? `HTTP ${status}`;
}

export async function triggerRouteAssistantAutoOptimize(
  deps: RouteOptimizeDeps
): Promise<RouteOptimizeSummary> {
  const { env, logger, fetchImpl } = deps;
  const appUrl = (env.APP_URL ?? "").trim().replace(TRAILING_SLASHES, "");
  const secret = (env.CRON_SECRET ?? "").trim();
  if (!appUrl || !secret) {
    logger.warn("route assistant auto optimize skipped: missing APP_URL or CRON_SECRET");
    return { requested: 0, skipped: 1 };
  }

  const response = await fetchImpl(`${appUrl}${AUTO_OPTIMIZE_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [CRON_SECRET_HEADER]: secret },
    body: JSON.stringify({}),
    // Una redirección (p. ej. a /login) significa que no se está hablando con el endpoint.
    redirect: "manual",
    signal: AbortSignal.timeout(ROUTE_OPTIMIZE_TIMEOUT_MS),
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
  logger.info("route assistant auto optimize", { response: data });
  return { requested: 1, skipped: 0 };
}
