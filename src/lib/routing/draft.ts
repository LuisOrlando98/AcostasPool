/**
 * Borrador editable del asistente de rutas (§6 del contrato): estado puro, sin
 * React ni Prisma. Todas las operaciones devuelven un `Draft` nuevo y nunca
 * mutan las entradas; las que no cambian nada devuelven el mismo borrador y no
 * apilan historial.
 *
 * Los tiempos (`estimatedArrivalTime`, `serviceStartTime`, `delayMinutes`,
 * `estimatedDriveMinutesFromPrevious`, `distanceMilesFromPrevious`,
 * `driveSource`) se conservan tal cual al editar: la interfaz los marca como
 * pendientes de recalcular y `applyRecalculatedPlan` los sustituye con la
 * respuesta de `POST /api/admin/routes/assistant/recalculate`.
 */
import type { AssistantPlan, AssistantStop } from "@/lib/routing/assistant-types";

/** Tope de instantáneas guardadas para deshacer. */
const HISTORY_LIMIT = 30;
/** Paso de `sortOrder` cuando la parada no tiene hora de inicio de servicio. */
const SORT_ORDER_STEP = 10;
const MINUTES_PER_HOUR = 60;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;
/** Las paradas excluidas no pertenecen a ninguna ruta propuesta. */
const NO_TECHNICIAN_ID = "";
const NO_TECHNICIAN_NAME = "";
const NO_ORDER = 0;
/** Las paradas sin posición en BD se ordenan al final. */
const UNKNOWN_SORT_ORDER = Number.MAX_SAFE_INTEGER;

export type DraftStop = AssistantStop;

export type DraftRoute = {
  readonly technicianId: string;
  readonly technicianName: string;
  readonly stops: readonly DraftStop[];
};

export type DraftChange =
  /** Posiciones 1-based: `from` es la posición actual en BD dentro de su técnico actual. */
  | { kind: "order"; jobId: string; technicianId: string; from: number; to: number }
  | { kind: "technician"; jobId: string; from: string | null; to: string }
  /** Excluida de la propuesta: se queda como está en la base de datos. */
  | { kind: "removed"; jobId: string };

export type DraftDiff = {
  readonly changes: readonly DraftChange[];
  readonly reordered: number;
  readonly reassigned: number;
  readonly removed: number;
  readonly total: number;
};

/** Estado previo a una edición, con la etiqueta de la acción que lo desplazó. */
export type DraftSnapshot = {
  routes: readonly DraftRoute[];
  removed: readonly DraftStop[];
  label: string;
};

export type DraftBaseline = {
  readonly routes: readonly DraftRoute[];
  readonly removed: readonly DraftStop[];
};

export type Draft = {
  readonly routes: readonly DraftRoute[];
  /** Excluidos de la propuesta (incluye los `unassigned` iniciales del plan). */
  readonly removed: readonly DraftStop[];
  readonly baseline: DraftBaseline;
  readonly history: readonly DraftSnapshot[];
};

export type DraftUpdate = { jobId: string; technicianId: string; sortOrder: number };

export type DraftRecalculateRequest = {
  date: string;
  routes: { technicianId: string; jobIds: string[] }[];
};

export type DraftTechnician = { id: string; name: string };

// --- Utilidades inmutables sobre listas -------------------------------------

function insertAt<T>(items: readonly T[], item: T, index: number): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

function removeAt<T>(items: readonly T[], index: number): T[] {
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

function replaceAt<T>(items: readonly T[], index: number, item: T): T[] {
  return items.map((current, position) => (position === index ? item : current));
}

/** Índice de inserción saneado: por defecto, al final de la lista. */
function resolveIndex(index: number | undefined, length: number): number {
  if (index === undefined || !Number.isFinite(index)) {
    return length;
  }
  return Math.max(0, Math.min(Math.trunc(index), length));
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

// --- Utilidades sobre paradas y rutas ---------------------------------------

/** Copia la parada con el técnico y la posición de su ruta (o la deja igual). */
function assignStop(
  stop: DraftStop,
  technicianId: string,
  technicianName: string,
  order: number,
): DraftStop {
  if (
    stop.technicianId === technicianId &&
    stop.technicianName === technicianName &&
    stop.order === order
  ) {
    return stop;
  }
  return { ...stop, technicianId, technicianName, order };
}

/** Parada fuera de la propuesta: sin técnico ni posición. */
function detachStop(stop: DraftStop): DraftStop {
  return assignStop(stop, NO_TECHNICIAN_ID, NO_TECHNICIAN_NAME, NO_ORDER);
}

/** Ruta nueva con esas paradas, renumeradas (1-based) y con su técnico. */
function withStops(route: DraftRoute, stops: readonly DraftStop[]): DraftRoute {
  return {
    technicianId: route.technicianId,
    technicianName: route.technicianName,
    stops: stops.map((stop, index) =>
      assignStop(stop, route.technicianId, route.technicianName, index + 1),
    ),
  };
}

function findRouteIndexByJob(routes: readonly DraftRoute[], jobId: string): number {
  return routes.findIndex((route) => route.stops.some((stop) => stop.jobId === jobId));
}

function findRouteIndexByTechnician(routes: readonly DraftRoute[], technicianId: string): number {
  return routes.findIndex((route) => route.technicianId === technicianId);
}

/** Borrador nuevo apilando el estado previo en el historial (tope 30). */
function commit(
  draft: Draft,
  label: string,
  routes: readonly DraftRoute[],
  removed: readonly DraftStop[],
): Draft {
  const history = [...draft.history, { routes: draft.routes, removed: draft.removed, label }];
  return {
    routes,
    removed,
    baseline: draft.baseline,
    history: history.length > HISTORY_LIMIT ? history.slice(history.length - HISTORY_LIMIT) : history,
  };
}

// --- Creación ---------------------------------------------------------------

export function createDraft(plan: AssistantPlan, technicians: readonly DraftTechnician[]): Draft {
  const routes = technicians.map((technician) => {
    const planned = plan.routes.find((route) => route.technicianId === technician.id);
    const empty: DraftRoute = {
      technicianId: technician.id,
      technicianName: technician.name,
      stops: [],
    };
    return withStops(empty, planned?.stops ?? []);
  });
  const removed = plan.unassigned.map(detachStop);
  return {
    routes,
    removed,
    baseline: { routes: [...routes], removed: [...removed] },
    history: [],
  };
}

// --- Edición ----------------------------------------------------------------

export function moveStop(draft: Draft, jobId: string, delta: -1 | 1): Draft {
  const routeIndex = findRouteIndexByJob(draft.routes, jobId);
  if (routeIndex < 0) {
    return draft;
  }
  const route = draft.routes[routeIndex];
  const from = route.stops.findIndex((stop) => stop.jobId === jobId);
  const to = from + delta;
  if (to < 0 || to >= route.stops.length) {
    return draft;
  }
  const stops = insertAt(removeAt(route.stops, from), route.stops[from], to);
  return commit(draft, `move:${jobId}`, replaceAt(draft.routes, routeIndex, withStops(route, stops)), draft.removed);
}

export function moveStopToRoute(
  draft: Draft,
  jobId: string,
  technicianId: string,
  index?: number,
): Draft {
  const sourceIndex = findRouteIndexByJob(draft.routes, jobId);
  const targetIndex = findRouteIndexByTechnician(draft.routes, technicianId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return draft;
  }
  const source = draft.routes[sourceIndex];
  const stopIndex = source.stops.findIndex((stop) => stop.jobId === jobId);
  const detached = removeAt(source.stops, stopIndex);
  const sameRoute = sourceIndex === targetIndex;
  const targetStops = sameRoute ? detached : draft.routes[targetIndex].stops;
  const position = resolveIndex(index, targetStops.length);
  if (sameRoute && position === stopIndex) {
    return draft;
  }
  const withoutStop = replaceAt(draft.routes, sourceIndex, withStops(source, detached));
  const target = withoutStop[targetIndex];
  const stops = insertAt(targetStops, source.stops[stopIndex], position);
  const routes = replaceAt(withoutStop, targetIndex, withStops(target, stops));
  return commit(draft, `reassign:${jobId}`, routes, draft.removed);
}

export function removeStop(draft: Draft, jobId: string): Draft {
  const routeIndex = findRouteIndexByJob(draft.routes, jobId);
  if (routeIndex < 0) {
    return draft;
  }
  const route = draft.routes[routeIndex];
  const stopIndex = route.stops.findIndex((stop) => stop.jobId === jobId);
  const routes = replaceAt(
    draft.routes,
    routeIndex,
    withStops(route, removeAt(route.stops, stopIndex)),
  );
  const removed = [...draft.removed, detachStop(route.stops[stopIndex])];
  return commit(draft, `remove:${jobId}`, routes, removed);
}

export function restoreStop(
  draft: Draft,
  jobId: string,
  technicianId: string,
  index?: number,
): Draft {
  const stopIndex = draft.removed.findIndex((stop) => stop.jobId === jobId);
  const routeIndex = findRouteIndexByTechnician(draft.routes, technicianId);
  if (stopIndex < 0 || routeIndex < 0) {
    return draft;
  }
  const route = draft.routes[routeIndex];
  const position = resolveIndex(index, route.stops.length);
  const stops = insertAt(route.stops, draft.removed[stopIndex], position);
  const routes = replaceAt(draft.routes, routeIndex, withStops(route, stops));
  return commit(draft, `restore:${jobId}`, routes, removeAt(draft.removed, stopIndex));
}

// --- Historial y estado -----------------------------------------------------

export function undo(draft: Draft): Draft {
  const snapshot = draft.history[draft.history.length - 1];
  if (!snapshot) {
    return draft;
  }
  return {
    routes: snapshot.routes,
    removed: snapshot.removed,
    baseline: draft.baseline,
    history: draft.history.slice(0, -1),
  };
}

export function resetDraft(draft: Draft): Draft {
  return {
    routes: draft.baseline.routes,
    removed: draft.baseline.removed,
    baseline: draft.baseline,
    history: [],
  };
}

export function canUndo(draft: Draft): boolean {
  return draft.history.length > 0;
}

export function lastUndoLabel(draft: Draft): string | null {
  return draft.history[draft.history.length - 1]?.label ?? null;
}

/** Firma de la asignación propuesta, para comparar con el estado inicial. */
function routesSignature(routes: readonly DraftRoute[]): string {
  return routes
    .map((route) => `${route.technicianId}:${route.stops.map((stop) => stop.jobId).join(",")}`)
    .join("|");
}

function removedSignature(removed: readonly DraftStop[]): string {
  return [...removed]
    .map((stop) => stop.jobId)
    .sort(compareText)
    .join(",");
}

export function isDirty(draft: Draft): boolean {
  return (
    routesSignature(draft.routes) !== routesSignature(draft.baseline.routes) ||
    removedSignature(draft.removed) !== removedSignature(draft.baseline.removed)
  );
}

// --- Diferencias frente a la base de datos ----------------------------------

function compareByCurrentOrder(left: DraftStop, right: DraftStop): number {
  const leftOrder = left.currentSortOrder ?? UNKNOWN_SORT_ORDER;
  const rightOrder = right.currentSortOrder ?? UNKNOWN_SORT_ORDER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return compareText(left.jobId, right.jobId);
}

/**
 * Posición 1-based que ocupa hoy cada parada del borrador dentro de su técnico
 * actual en BD, ordenando por `currentSortOrder` (empates por `jobId`). Se
 * cuentan también las paradas excluidas: siguen ocupando su sitio en BD.
 */
function currentPositionsByJob(draft: Draft): Map<string, number> {
  const stops = [...draft.routes.flatMap((route) => route.stops), ...draft.removed];
  const technicianIds = [
    ...new Set(
      stops
        .map((stop) => stop.currentTechnicianId)
        .filter((technicianId): technicianId is string => technicianId !== null),
    ),
  ];
  return new Map(
    technicianIds.flatMap((technicianId) =>
      stops
        .filter((stop) => stop.currentTechnicianId === technicianId)
        .sort(compareByCurrentOrder)
        .map((stop, index): [string, number] => [stop.jobId, index + 1]),
    ),
  );
}

/** Cambio de una parada propuesta: reasignación, reordenación o ninguno. */
function describeStopChange(
  stop: DraftStop,
  technicianId: string,
  position: number,
  positions: ReadonlyMap<string, number>,
): DraftChange[] {
  if (stop.currentTechnicianId !== technicianId) {
    return [
      { kind: "technician", jobId: stop.jobId, from: stop.currentTechnicianId, to: technicianId },
    ];
  }
  const from = positions.get(stop.jobId);
  if (from === undefined || from === position) {
    return [];
  }
  return [{ kind: "order", jobId: stop.jobId, technicianId, from, to: position }];
}

export function diffDraft(draft: Draft): DraftDiff {
  const positions = currentPositionsByJob(draft);
  const changes: DraftChange[] = [
    ...draft.routes.flatMap((route) =>
      route.stops.flatMap((stop, index) =>
        describeStopChange(stop, route.technicianId, index + 1, positions),
      ),
    ),
    ...draft.removed
      .filter((stop) => stop.currentTechnicianId !== null)
      .map((stop): DraftChange => ({ kind: "removed", jobId: stop.jobId })),
  ];
  const countOf = (kind: DraftChange["kind"]): number =>
    changes.filter((change) => change.kind === kind).length;
  return {
    changes,
    reordered: countOf("order"),
    reassigned: countOf("technician"),
    removed: countOf("removed"),
    total: changes.length,
  };
}

// --- Salidas hacia la API ---------------------------------------------------

export function toRecalculateRequest(draft: Draft, date: string): DraftRecalculateRequest {
  return {
    date,
    routes: draft.routes
      .filter((route) => route.stops.length > 0)
      .map((route) => ({
        technicianId: route.technicianId,
        jobIds: route.stops.map((stop) => stop.jobId),
      })),
  };
}

export function applyRecalculatedPlan(draft: Draft, plan: AssistantPlan): Draft {
  const routes = draft.routes.map((route) => {
    const recalculated = plan.routes.find(
      (candidate) => candidate.technicianId === route.technicianId,
    );
    return recalculated ? withStops(route, recalculated.stops) : route;
  });
  return {
    routes,
    removed: draft.removed,
    baseline: draft.baseline,
    history: draft.history,
  };
}

/** Minuto del día de una hora "HH:mm"; `null` si está vacía o no parsea. */
function parseMinuteOfDay(time: string): number | null {
  const match = time ? TIME_PATTERN.exec(time.trim()) : null;
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > MAX_HOUR || minutes > MAX_MINUTE) {
    return null;
  }
  return hours * MINUTES_PER_HOUR + minutes;
}

function routeUpdates(route: DraftRoute): DraftUpdate[] {
  const minutes = route.stops.map((stop) => parseMinuteOfDay(stop.serviceStartTime));
  return route.stops.map((stop, index) => {
    const minuteOfDay = minutes[index];
    const ties = minutes.slice(0, index).filter((other) => other === minuteOfDay).length;
    return {
      jobId: stop.jobId,
      technicianId: route.technicianId,
      sortOrder: minuteOfDay === null ? (index + 1) * SORT_ORDER_STEP : minuteOfDay + ties,
    };
  });
}

export function toUpdates(draft: Draft): DraftUpdate[] {
  return draft.routes.flatMap(routeUpdates);
}
