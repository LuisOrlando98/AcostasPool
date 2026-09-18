import { ROUTE_OPTIMIZE_TIMEOUT_MS } from "@/lib/worker/constants";
import {
  callInternalEndpoint,
  type InternalEndpointDeps,
  type InternalEndpointSummary,
} from "@/lib/worker/internal-endpoint";

/** Dispara la optimización diaria del asistente de rutas a través del endpoint interno de la web. */

export const AUTO_OPTIMIZE_PATH = "/api/internal/routes/assistant/auto-optimize";
const AUTO_OPTIMIZE_LABEL = "route assistant auto optimize";

export type RouteOptimizeDeps = InternalEndpointDeps;
export type RouteOptimizeSummary = InternalEndpointSummary;

export async function triggerRouteAssistantAutoOptimize(
  deps: RouteOptimizeDeps
): Promise<RouteOptimizeSummary> {
  return callInternalEndpoint(deps, {
    path: AUTO_OPTIMIZE_PATH,
    label: AUTO_OPTIMIZE_LABEL,
    timeoutMs: ROUTE_OPTIMIZE_TIMEOUT_MS,
  });
}
