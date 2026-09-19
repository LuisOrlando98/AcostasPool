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
 * Rutas que terminan después de medianoche en el último plan del servidor: el
 * borrador no guarda `overflowsDay`, así que la vista lo recoge del plan y lo
 * cruza con las rutas que siguen teniendo paradas.
 */
export function collectLateTechnicianIds(
  routes: readonly {
    readonly technicianId: string;
    readonly overflowsDay?: boolean;
  }[]
): ReadonlySet<string> {
  return new Set(
    routes.filter((route) => route.overflowsDay).map((route) => route.technicianId)
  );
}

const NO_LATE_ROUTES: ReadonlySet<string> = new Set<string>();

/** Una ruta que se ha quedado sin paradas ya no puede terminar tarde. */
export function countLateRoutes(
  routes: readonly RouteLike[],
  lateTechnicianIds: ReadonlySet<string>
): number {
  return routes.filter(
    (route) => route.stops.length > 0 && lateTechnicianIds.has(route.technicianId)
  ).length;
}

/**
 * Avisos de la propuesta: una parada sin ubicación es un aviso (sus tiempos
 * son una estimación grosera) y una ruta que termina después de medianoche,
 * otro. El retraso frente a la hora citada no cuenta: los servicios de piscina
 * se programan por día, no por hora.
 */
export type DraftSummary = RouteLoad & {
  readonly withoutCoordinates: number;
  readonly lateRoutes: number;
  readonly warnings: number;
};

export function summarizeRoutes(
  routes: readonly RouteLike[],
  lateTechnicianIds: ReadonlySet<string> = NO_LATE_ROUTES
): DraftSummary {
  const load = routes.reduce<RouteLoad>(
    (total, route) => {
      const routeLoad = summarizeRoute(route);
      return {
        stops: total.stops + routeLoad.stops,
        driveMinutes: total.driveMinutes + routeLoad.driveMinutes,
        serviceMinutes: total.serviceMinutes + routeLoad.serviceMinutes,
      };
    },
    { stops: 0, driveMinutes: 0, serviceMinutes: 0 }
  );
  const withoutCoordinates = countStopsWithoutCoordinates(routes);
  const lateRoutes = countLateRoutes(routes, lateTechnicianIds);
  return {
    ...load,
    withoutCoordinates,
    lateRoutes,
    warnings: withoutCoordinates + lateRoutes,
  };
}
