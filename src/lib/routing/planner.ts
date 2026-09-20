import { BUSINESS_TIMEZONE } from "@/lib/jobs/capacity";
import type {
  AssistantJobStatus,
  AssistantPlan,
  AssistantPlanSummary,
  AssistantRoute,
  AssistantStop,
  AssistantUpdate,
} from "@/lib/routing/assistant-types";
import type { GeoPoint } from "@/lib/routing/geo";
import {
  estimateDriveMinutes,
  getAddressPairKey,
  getTravelMetricsForPairs,
  haversineMiles,
  type AddressPairInput,
  type TravelMetric,
  type TravelMetricSource,
} from "@/lib/routing/travel";
import { optimizeTourOrder } from "@/lib/routing/tour";

const DEFAULT_SERVICE_MINUTES = 60;
const MIN_SERVICE_MINUTES = 30;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
const ROUTE_START_MINUTES = 8 * MINUTES_PER_HOUR;
const PRE_ARRIVAL_BUFFER_MINUTES = 20;
const UNKNOWN_DISTANCE_MILES = 4;
/** Pesos de la asignación de técnicos (distancia al centroide vs. carga). */
const SHORT_DRIVE_DISTANCE_WEIGHT = 10;
const SHORT_DRIVE_LOAD_WEIGHT = 2;
const BALANCED_DISTANCE_WEIGHT = 4;
const BALANCED_LOAD_WEIGHT = 12;
export const DEFAULT_ROUTE_ORIGIN_ADDRESS =
  "10731 SW 147th Ct, Miami, FL 33196";

const timePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
});

export type RouteAssistantStrategy = "BALANCED" | "SHORT_DRIVE" | "KEEP_ASSIGNMENTS";

export type RouteAssistantJob = {
  id: string;
  customerName: string;
  address: string;
  /** Propiedad del trabajo: la parada la lleva para corregir su ubicación. */
  propertyId: string;
  propertyName: string | null;
  status: AssistantJobStatus;
  technicianId: string | null;
  planName: string | null;
  routeGroupId: string | null;
  routeGroupLabel: string | null;
  lockedTechnicianId: string | null;
  /** Estado actual en la base de datos, para mostrar qué cambia al aplicar. */
  currentTechnicianId: string | null;
  currentTechnicianName: string | null;
  currentSortOrder: number | null;
  scheduledDate: Date;
  estimatedDurationMinutes: number | null;
  coordinates: GeoPoint | null;
};

export type RouteAssistantTechnician = {
  id: string;
  name: string;
};

/** Alias de los tipos del contrato: el planner es quien los produce. */
export type RouteAssistantStopPlan = AssistantStop;
export type RouteAssistantTechnicianPlan = AssistantRoute;
export type RouteAssistantPlan = AssistantPlan;

export type RouteWaypoint = {
  address: string;
  coordinates: GeoPoint | null;
};

export const DEFAULT_ROUTE_ASSISTANT_STRATEGIES: RouteAssistantStrategy[] = [
  "BALANCED",
  "SHORT_DRIVE",
  "KEEP_ASSIGNMENTS",
];

type RouteLeg = {
  driveMinutes: number;
  distanceMiles: number | null;
  source: TravelMetricSource;
};

type StopTiming = {
  scheduledMinutes: number;
  arrivalMinutes: number;
  serviceStartMinutes: number;
  serviceMinutes: number;
  endMinutes: number;
};

type Assignment = {
  buckets: Map<string, RouteAssistantJob[]>;
  /** Trabajos que la estrategia deja sin técnico (nunca se auto-asignan). */
  unassigned: RouteAssistantJob[];
};

function toMinutesInBusinessTimezone(date: Date) {
  const parts = timePartsFormatter.formatToParts(date);
  const hourPart = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minutePart = parts.find((part) => part.type === "minute")?.value ?? "00";
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return ROUTE_START_MINUTES;
  }
  return Math.max(0, hour * MINUTES_PER_HOUR + minute);
}

/**
 * "HH:mm" del minuto indicado. Los minutos que caen en el día siguiente NO se
 * recortan a 23:59: se devuelve la hora real (00:45) y el llamante marca el
 * salto de día con `overflowsDay`.
 */
function minutesToTimeValue(minutes: number) {
  const rounded = Math.round(minutes);
  const normalized =
    ((rounded % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = String(Math.floor(normalized / MINUTES_PER_HOUR)).padStart(2, "0");
  const mins = String(normalized % MINUTES_PER_HOUR).padStart(2, "0");
  return `${hours}:${mins}`;
}

function isNextDay(minutes: number) {
  return Math.round(minutes) >= MINUTES_PER_DAY;
}

function estimateDistanceMiles(from: GeoPoint | null, to: GeoPoint | null) {
  if (!from || !to) {
    return null;
  }
  return haversineMiles(from, to);
}

function centroid(points: GeoPoint[]) {
  if (points.length === 0) {
    return null;
  }
  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  } satisfies GeoPoint;
}

function getLoadSpread(counts: number[]) {
  if (counts.length === 0) {
    return 0;
  }
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  return max - min;
}

function sortByScheduledTime(a: RouteAssistantJob, b: RouteAssistantJob) {
  return a.scheduledDate.getTime() - b.scheduledDate.getTime();
}

function getServiceMinutes(job: RouteAssistantJob) {
  return Math.max(
    MIN_SERVICE_MINUTES,
    job.estimatedDurationMinutes ?? DEFAULT_SERVICE_MINUTES
  );
}

function getRouteStartMinutes(jobs: readonly RouteAssistantJob[]) {
  const scheduledMinutes = jobs.map((job) =>
    toMinutesInBusinessTimezone(job.scheduledDate)
  );
  if (scheduledMinutes.length === 0) {
    return ROUTE_START_MINUTES;
  }
  return Math.max(
    ROUTE_START_MINUTES,
    Math.min(...scheduledMinutes) - PRE_ARRIVAL_BUFFER_MINUTES
  );
}

/**
 * El servicio empieza al llegar: no se espera a la hora citada, porque los
 * servicios se programan por día y no por hora. La hora citada solo se conserva
 * como referencia (`scheduledTime`, `delayMinutes`).
 */
function simulateStop(
  cursorMinutes: number,
  driveMinutes: number,
  job: RouteAssistantJob
): StopTiming {
  const scheduledMinutes = toMinutesInBusinessTimezone(job.scheduledDate);
  const arrivalMinutes = cursorMinutes + driveMinutes;
  const serviceStartMinutes = arrivalMinutes;
  const serviceMinutes = getServiceMinutes(job);
  return {
    scheduledMinutes,
    arrivalMinutes,
    serviceStartMinutes,
    serviceMinutes,
    endMinutes: serviceStartMinutes + serviceMinutes,
  };
}

/**
 * Tramo entre dos puntos: usa la métrica de travel (tráfico real o estimada)
 * y, si no existe para el par, la estimación haversine propia.
 */
function resolveLeg(
  pairMetrics: Map<string, TravelMetric>,
  from: RouteWaypoint,
  to: RouteWaypoint
): RouteLeg {
  const metric = pairMetrics.get(getAddressPairKey(from.address, to.address));
  return {
    driveMinutes:
      metric?.durationMinutes ??
      estimateDriveMinutes(from.coordinates, to.coordinates),
    distanceMiles:
      metric?.distanceMiles ??
      estimateDistanceMiles(from.coordinates, to.coordinates),
    source: metric?.source ?? "ESTIMATED",
  };
}

function pickTechnicianForJob(
  job: RouteAssistantJob,
  technicians: RouteAssistantTechnician[],
  buckets: Map<string, RouteAssistantJob[]>,
  strategy: RouteAssistantStrategy
) {
  let selectedTechnician = technicians[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const technician of technicians) {
    const assigned = buckets.get(technician.id) ?? [];
    const assignedPoints = assigned
      .map((entry) => entry.coordinates)
      .filter((entry): entry is GeoPoint => Boolean(entry));
    const distanceMiles =
      estimateDistanceMiles(centroid(assignedPoints), job.coordinates) ??
      UNKNOWN_DISTANCE_MILES;
    const load = assigned.length;
    const score =
      strategy === "SHORT_DRIVE"
        ? distanceMiles * SHORT_DRIVE_DISTANCE_WEIGHT + load * SHORT_DRIVE_LOAD_WEIGHT
        : distanceMiles * BALANCED_DISTANCE_WEIGHT + load * BALANCED_LOAD_WEIGHT;

    if (score < bestScore) {
      bestScore = score;
      selectedTechnician = technician;
    }
  }

  return selectedTechnician;
}

function assignJobs(
  jobs: readonly RouteAssistantJob[],
  technicians: RouteAssistantTechnician[],
  strategy: RouteAssistantStrategy
): Assignment {
  const buckets = new Map<string, RouteAssistantJob[]>();
  for (const technician of technicians) {
    buckets.set(technician.id, []);
  }

  const pool: RouteAssistantJob[] = [];
  const unassigned: RouteAssistantJob[] = [];
  for (const job of [...jobs].sort(sortByScheduledTime)) {
    const lockedTechnicianId =
      job.lockedTechnicianId && buckets.has(job.lockedTechnicianId)
        ? job.lockedTechnicianId
        : null;
    if (lockedTechnicianId) {
      buckets.get(lockedTechnicianId)?.push(job);
      continue;
    }
    if (strategy !== "KEEP_ASSIGNMENTS") {
      pool.push(job);
      continue;
    }
    // KEEP_ASSIGNMENTS respeta la BD: un trabajo sin técnico no se auto-asigna.
    if (job.technicianId && buckets.has(job.technicianId)) {
      buckets.get(job.technicianId)?.push(job);
    } else {
      unassigned.push(job);
    }
  }

  for (const job of pool) {
    const technician = pickTechnicianForJob(job, technicians, buckets, strategy);
    buckets.get(technician.id)?.push(job);
  }

  return { buckets, unassigned };
}

/**
 * Pares cuyo tiempo de viaje se solicita a travel: origen→parada, parada↔parada
 * y parada→origen. Con una sola parada quedan origen→parada y parada→origen,
 * de modo que el regreso también puede usar tráfico real.
 */
function buildTravelPairs(
  stops: readonly RouteAssistantJob[],
  origin: RouteWaypoint
): AddressPairInput[] {
  return [
    ...stops.map((stop) => toPair(origin, stop)),
    ...stops.flatMap((fromStop) =>
      stops
        .filter((toStop) => toStop.id !== fromStop.id)
        .map((toStop) => toPair(fromStop, toStop))
    ),
    ...stops.map((stop) => toPair(stop, origin)),
  ];
}

function toPair(from: RouteWaypoint, to: RouteWaypoint): AddressPairInput {
  return {
    fromAddress: from.address,
    toAddress: to.address,
    fromCoordinates: from.coordinates,
    toCoordinates: to.coordinates,
  };
}

/**
 * Pares de un orden ya fijado: origen→1, 1→2, …, n→origen. Es lo que necesita
 * un recálculo manual, que no tiene que evaluar alternativas.
 */
export function buildSequentialTravelPairs(
  stops: readonly RouteAssistantJob[],
  origin: RouteWaypoint
): AddressPairInput[] {
  if (stops.length === 0) {
    return [];
  }
  return [
    toPair(origin, stops[0]),
    ...stops.slice(1).map((stop, index) => toPair(stops[index], stop)),
    toPair(stops[stops.length - 1], origin),
  ];
}

/**
 * Una parada es localizable si tiene coordenadas o si travel resolvió con
 * tráfico real su tramo desde la base. El resto solo tiene el tiempo por
 * defecto: meterlas en la optimización falsearía el circuito.
 */
function isLocatable(
  pairMetrics: Map<string, TravelMetric>,
  origin: RouteWaypoint,
  stop: RouteAssistantJob
) {
  if (stop.coordinates) {
    return true;
  }
  const metric = pairMetrics.get(getAddressPairKey(origin.address, stop.address));
  return metric?.source === "LIVE_TRAFFIC";
}

/** Minutos de conducción entre todos los puntos: la base en 0 y las paradas en 1..n. */
function buildDriveMatrix(
  pairMetrics: Map<string, TravelMetric>,
  origin: RouteWaypoint,
  stops: readonly RouteAssistantJob[]
): number[][] {
  const nodes: readonly RouteWaypoint[] = [origin, ...stops];
  return nodes.map((from, fromIndex) =>
    nodes.map((to, toIndex) =>
      fromIndex === toIndex ? 0 : resolveLeg(pairMetrics, from, to).driveMinutes
    )
  );
}

/**
 * Ordena las paradas para minimizar la conducción del circuito completo:
 * base → todas las paradas → base (ver tour.ts). La hora citada no interviene:
 * los servicios se programan por día, no por hora. Las paradas sin ubicación
 * van al final, en su orden de agenda, con su aviso correspondiente.
 */
async function orderByOptimizedRoute(
  stops: RouteAssistantJob[],
  origin: RouteWaypoint
) {
  const pairMetrics = await getTravelMetricsForPairs(
    buildTravelPairs(stops, origin)
  );
  const byAgenda = [...stops].sort(sortByScheduledTime);
  const locatable = byAgenda.filter((stop) => isLocatable(pairMetrics, origin, stop));
  const unlocatable = byAgenda.filter(
    (stop) => !isLocatable(pairMetrics, origin, stop)
  );
  const tourOrder = optimizeTourOrder(
    buildDriveMatrix(pairMetrics, origin, locatable),
    locatable.length
  );

  return {
    orderedStops: [...tourOrder.map((node) => locatable[node - 1]), ...unlocatable],
    pairMetrics,
  };
}

type Itinerary = {
  cursorMinutes: number;
  stops: RouteAssistantStopPlan[];
  totalDriveMinutes: number;
  totalServiceMinutes: number;
};

function buildStop(
  job: RouteAssistantJob,
  technician: RouteAssistantTechnician,
  order: number,
  leg: RouteLeg,
  timing: StopTiming
): RouteAssistantStopPlan {
  const delay = Math.max(0, timing.serviceStartMinutes - timing.scheduledMinutes);
  return {
    jobId: job.id,
    customerName: job.customerName,
    address: job.address,
    propertyId: job.propertyId,
    propertyName: job.propertyName,
    planName: job.planName,
    routeGroupId: job.routeGroupId,
    routeGroupLabel: job.routeGroupLabel,
    technicianId: technician.id,
    technicianName: technician.name,
    order,
    scheduledTime: minutesToTimeValue(timing.scheduledMinutes),
    estimatedArrivalTime: minutesToTimeValue(timing.arrivalMinutes),
    serviceStartTime: minutesToTimeValue(timing.serviceStartMinutes),
    estimatedDriveMinutesFromPrevious: leg.driveMinutes,
    estimatedServiceMinutes: timing.serviceMinutes,
    distanceMilesFromPrevious:
      leg.distanceMiles == null ? null : Number(leg.distanceMiles.toFixed(2)),
    delayMinutes: delay > 0 ? delay : null,
    driveSource: leg.source,
    status: job.status,
    currentTechnicianId: job.currentTechnicianId,
    currentTechnicianName: job.currentTechnicianName,
    currentSortOrder: job.currentSortOrder,
    hasCoordinates: Boolean(job.coordinates),
  };
}

/** Parada fuera de la propuesta: sin técnico y con los tiempos de la cita. */
function toUnassignedStop(
  job: RouteAssistantJob,
  index: number
): RouteAssistantStopPlan {
  const scheduledMinutes = toMinutesInBusinessTimezone(job.scheduledDate);
  const timing: StopTiming = {
    scheduledMinutes,
    arrivalMinutes: scheduledMinutes,
    serviceStartMinutes: scheduledMinutes,
    serviceMinutes: getServiceMinutes(job),
    endMinutes: scheduledMinutes + getServiceMinutes(job),
  };
  const stop = buildStop(
    job,
    { id: "", name: "" },
    index + 1,
    { driveMinutes: 0, distanceMiles: null, source: "ESTIMATED" },
    timing
  );
  return { ...stop, driveSource: undefined };
}

function buildItinerary(
  technician: RouteAssistantTechnician,
  orderedStops: readonly RouteAssistantJob[],
  origin: RouteWaypoint,
  pairMetrics: Map<string, TravelMetric>
): Itinerary {
  const initial: Itinerary = {
    cursorMinutes: getRouteStartMinutes(orderedStops),
    stops: [],
    totalDriveMinutes: 0,
    totalServiceMinutes: 0,
  };
  return orderedStops.reduce((acc, current, index) => {
    const previous = index > 0 ? orderedStops[index - 1] : origin;
    const leg = resolveLeg(pairMetrics, previous, current);
    const timing = simulateStop(acc.cursorMinutes, leg.driveMinutes, current);
    const stop = buildStop(current, technician, index + 1, leg, timing);
    return {
      cursorMinutes: timing.endMinutes,
      stops: [...acc.stops, stop],
      totalDriveMinutes: acc.totalDriveMinutes + leg.driveMinutes,
      totalServiceMinutes: acc.totalServiceMinutes + timing.serviceMinutes,
    };
  }, initial);
}

/**
 * Avisos de una ruta: una parada sin coordenadas (su llegada es una estimación
 * ciega) y una ruta que termina después de medianoche. El retraso frente a la
 * hora citada NO cuenta: los servicios se programan por día, no por hora.
 */
function countRouteWarnings(
  stops: readonly RouteAssistantStopPlan[],
  overflowsDay: boolean
) {
  const withoutCoordinates = stops.filter((stop) => !stop.hasCoordinates).length;
  return withoutCoordinates + (overflowsDay ? 1 : 0);
}

function uniqueStrings(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
}

/** Construye la ruta de un técnico a partir de un orden de paradas ya fijado. */
export function buildTechnicianPlanFromOrder(
  technician: RouteAssistantTechnician,
  orderedStops: readonly RouteAssistantJob[],
  origin: RouteWaypoint,
  pairMetrics: Map<string, TravelMetric>
): RouteAssistantTechnicianPlan {
  const itinerary = buildItinerary(technician, orderedStops, origin, pairMetrics);
  const lastStop = orderedStops[orderedStops.length - 1] ?? null;
  const returnLeg = lastStop ? resolveLeg(pairMetrics, lastStop, origin) : null;
  const returnDriveMinutes = returnLeg?.driveMinutes ?? 0;
  const returnDistanceMiles = returnLeg?.distanceMiles ?? null;
  const totalDriveMinutes = itinerary.totalDriveMinutes + returnDriveMinutes;
  const returnMinutes = itinerary.cursorMinutes + returnDriveMinutes;
  const overflowsDay = Boolean(returnLeg) && isNextDay(returnMinutes);

  return {
    technicianId: technician.id,
    technicianName: technician.name,
    originAddress: origin.address,
    routeGroupIds: uniqueStrings(itinerary.stops.map((stop) => stop.routeGroupId)),
    routeGroupLabels: uniqueStrings(
      itinerary.stops.map((stop) => stop.routeGroupLabel)
    ),
    stops: itinerary.stops,
    totalDriveMinutes,
    returnDriveMinutes,
    totalServiceMinutes: itinerary.totalServiceMinutes,
    totalRouteMinutes: totalDriveMinutes + itinerary.totalServiceMinutes,
    returnDistanceMiles:
      returnDistanceMiles == null ? null : Number(returnDistanceMiles.toFixed(2)),
    returnDriveSource: returnLeg?.source,
    estimatedReturnTime: returnLeg ? minutesToTimeValue(returnMinutes) : null,
    ...(overflowsDay ? { overflowsDay: true } : {}),
    conflicts: countRouteWarnings(itinerary.stops, overflowsDay),
  };
}

async function buildTechnicianPlan(
  technician: RouteAssistantTechnician,
  assignedJobs: RouteAssistantJob[],
  origin: RouteWaypoint
): Promise<RouteAssistantTechnicianPlan> {
  const { orderedStops, pairMetrics } = await orderByOptimizedRoute(
    assignedJobs,
    origin
  );
  return buildTechnicianPlanFromOrder(technician, orderedStops, origin, pairMetrics);
}

/** Agrega los totales de las rutas con paradas del plan (avisos incluidos). */
export function summarizePlan(
  routes: readonly RouteAssistantTechnicianPlan[],
  loadSpread: number
): AssistantPlanSummary {
  const totals = routes.reduce(
    (acc, route) => ({
      totalStops: acc.totalStops + route.stops.length,
      totalDriveMinutes: acc.totalDriveMinutes + route.totalDriveMinutes,
      totalServiceMinutes: acc.totalServiceMinutes + route.totalServiceMinutes,
      totalRouteMinutes: acc.totalRouteMinutes + route.totalRouteMinutes,
      conflicts: acc.conflicts + route.conflicts,
    }),
    {
      totalStops: 0,
      totalDriveMinutes: 0,
      totalServiceMinutes: 0,
      totalRouteMinutes: 0,
      conflicts: 0,
    }
  );
  return { ...totals, loadSpread };
}

function timeValueToDayMinutes(value: string) {
  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return hours * MINUTES_PER_HOUR + minutes;
}

/**
 * `sortOrder` = minuto del día en que empieza el servicio; si dos paradas de la
 * misma ruta coinciden, la segunda suma su índice para no empatar.
 */
function buildRouteUpdates(
  route: RouteAssistantTechnicianPlan
): AssistantUpdate[] {
  const used = new Set<number>();
  return route.stops.map((stop, index) => {
    const base = timeValueToDayMinutes(stop.serviceStartTime);
    const sortOrder = used.has(base) ? base + index : base;
    used.add(sortOrder);
    return { jobId: stop.jobId, technicianId: route.technicianId, sortOrder };
  });
}

function buildPlanFromRoutes(
  strategy: AssistantPlan["strategy"],
  technicianRoutes: readonly RouteAssistantTechnicianPlan[],
  unassignedJobs: readonly RouteAssistantJob[]
): RouteAssistantPlan {
  // El desequilibrio de carga se mide sobre TODOS los técnicos, incluidos los
  // que se quedan sin paradas; solo después se omiten las rutas vacías.
  const loadSpread = getLoadSpread(
    technicianRoutes.map((route) => route.stops.length)
  );
  const routes = technicianRoutes.filter((route) => route.stops.length > 0);
  return {
    strategy,
    routes,
    unassigned: unassignedJobs.map(toUnassignedStop),
    summary: summarizePlan(routes, loadSpread),
    updates: routes.flatMap(buildRouteUpdates),
  };
}

async function buildPlan(
  jobs: readonly RouteAssistantJob[],
  technicians: RouteAssistantTechnician[],
  strategy: RouteAssistantStrategy,
  origin: RouteWaypoint
): Promise<RouteAssistantPlan> {
  const { buckets, unassigned } = assignJobs(jobs, technicians, strategy);
  const technicianRoutes = await Promise.all(
    technicians.map((technician) =>
      buildTechnicianPlan(technician, buckets.get(technician.id) ?? [], origin)
    )
  );
  return buildPlanFromRoutes(strategy, technicianRoutes, unassigned);
}

function toOrigin(address: string | undefined, coordinates: GeoPoint | null) {
  return {
    address: address ?? DEFAULT_ROUTE_ORIGIN_ADDRESS,
    coordinates,
  } satisfies RouteWaypoint;
}

export async function buildRouteAssistantPlans(input: {
  jobs: RouteAssistantJob[];
  technicians: RouteAssistantTechnician[];
  originAddress?: string;
  originCoordinates?: GeoPoint | null;
  strategies?: RouteAssistantStrategy[];
}) {
  const {
    jobs,
    technicians,
    originAddress,
    originCoordinates = null,
    strategies = DEFAULT_ROUTE_ASSISTANT_STRATEGIES,
  } = input;
  if (jobs.length === 0 || technicians.length === 0) {
    return [] as RouteAssistantPlan[];
  }

  const origin = toOrigin(originAddress, originCoordinates);
  return Promise.all(
    strategies.map((strategy) => buildPlan(jobs, technicians, strategy, origin))
  );
}

export type FixedOrderRouteInput = {
  technician: RouteAssistantTechnician;
  jobIds: readonly string[];
};

/**
 * Plan `MANUAL`: respeta el orden recibido y solo pide a travel los tramos
 * consecutivos (origen→1, 1→2, …, n→origen). Los trabajos que no aparecen en
 * ninguna ruta quedan en `unassigned`.
 */
export async function buildFixedOrderPlan(input: {
  routes: readonly FixedOrderRouteInput[];
  jobs: readonly RouteAssistantJob[];
  originAddress?: string;
  originCoordinates?: GeoPoint | null;
}): Promise<RouteAssistantPlan> {
  const origin = toOrigin(input.originAddress, input.originCoordinates ?? null);
  const jobsById = new Map(input.jobs.map((job) => [job.id, job]));
  const orderedRoutes = input.routes.map((route) => ({
    technician: route.technician,
    stops: route.jobIds
      .map((jobId) => jobsById.get(jobId))
      .filter((job): job is RouteAssistantJob => Boolean(job)),
  }));

  const pairMetrics = await getTravelMetricsForPairs(
    orderedRoutes.flatMap((route) =>
      buildSequentialTravelPairs(route.stops, origin)
    )
  );
  const technicianRoutes = orderedRoutes.map((route) =>
    buildTechnicianPlanFromOrder(route.technician, route.stops, origin, pairMetrics)
  );

  const assignedIds = new Set(
    orderedRoutes.flatMap((route) => route.stops.map((stop) => stop.id))
  );
  const unassigned = input.jobs.filter((job) => !assignedIds.has(job.id));
  return buildPlanFromRoutes("MANUAL", technicianRoutes, unassigned);
}
