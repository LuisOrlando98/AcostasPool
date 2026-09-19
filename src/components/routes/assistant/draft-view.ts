/**
 * Lecturas puras sobre las rutas del borrador. Se declaran contra la forma
 * estructural de `DraftRoute` (`@/lib/routing/draft`) en lugar de importarlo,
 * para poder probarlas sin React ni el módulo del borrador.
 */

import type { AssistantStop } from "@/lib/routing/assistant-types";

export type RouteLike = {
  readonly technicianId: string;
  readonly technicianName: string;
  readonly stops: readonly AssistantStop[];
};

export type StopLocation = {
  readonly stop: AssistantStop;
  readonly route: RouteLike;
  /** Posición 1-based dentro de su ruta. */
  readonly position: number;
};

export type RouteLoad = {
  readonly stops: number;
  readonly driveMinutes: number;
  readonly serviceMinutes: number;
};

export function collectStops(routes: readonly RouteLike[]): AssistantStop[] {
  return routes.flatMap((route) => [...route.stops]);
}

export function findStopLocation(
  routes: readonly RouteLike[],
  jobId: string
): StopLocation | null {
  for (const route of routes) {
    const index = route.stops.findIndex((stop) => stop.jobId === jobId);
    if (index >= 0) {
      return { stop: route.stops[index], route, position: index + 1 };
    }
  }
  return null;
}

export function summarizeRoute(route: RouteLike): RouteLoad {
  return route.stops.reduce<RouteLoad>(
    (load, stop) => ({
      stops: load.stops + 1,
      driveMinutes: load.driveMinutes + stop.estimatedDriveMinutesFromPrevious,
      serviceMinutes: load.serviceMinutes + stop.estimatedServiceMinutes,
    }),
    { stops: 0, driveMinutes: 0, serviceMinutes: 0 }
  );
}

/** Paradas sin coordenadas: sus tiempos son una estimación grosera. */
export function countStopsWithoutCoordinates(routes: readonly RouteLike[]): number {
  return collectStops(routes).filter((stop) => !stop.hasCoordinates).length;
}

/**
 * Técnico al que vuelve una parada restaurada: el que tiene asignado en la
 * base de datos si sigue en la propuesta, si no el de la propuesta anterior y,
 * como último recurso, la primera ruta. `""` si no hay ninguna ruta.
 */
export function resolveRestoreTarget(
  routes: readonly RouteLike[],
  stop: AssistantStop
): string {
  const candidates = [stop.currentTechnicianId, stop.technicianId];
  const match = candidates.find(
    (candidate) =>
      candidate && routes.some((route) => route.technicianId === candidate)
  );
  return match ?? routes[0]?.technicianId ?? "";
}

/**
 * Mismo umbral que `CONFLICT_DELAY_THRESHOLD_MINUTES` en
 * `src/lib/routing/planner.ts`: el borrador no guarda el resumen del servidor,
 * así que los conflictos se recuentan sobre las paradas del momento.
 */
export const CONFLICT_DELAY_THRESHOLD_MINUTES = 25;

export type DraftSummary = RouteLoad & {
  readonly conflicts: number;
  readonly withoutCoordinates: number;
};

export function summarizeRoutes(routes: readonly RouteLike[]): DraftSummary {
  return collectStops(routes).reduce<DraftSummary>(
    (summary, stop) => ({
      stops: summary.stops + 1,
      driveMinutes: summary.driveMinutes + stop.estimatedDriveMinutesFromPrevious,
      serviceMinutes: summary.serviceMinutes + stop.estimatedServiceMinutes,
      conflicts:
        summary.conflicts +
        ((stop.delayMinutes ?? 0) > CONFLICT_DELAY_THRESHOLD_MINUTES ? 1 : 0),
      withoutCoordinates: summary.withoutCoordinates + (stop.hasCoordinates ? 0 : 1),
    }),
    { stops: 0, driveMinutes: 0, serviceMinutes: 0, conflicts: 0, withoutCoordinates: 0 }
  );
}
