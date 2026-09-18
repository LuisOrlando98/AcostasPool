import { BUSINESS_TIMEZONE } from "@/lib/jobs/capacity";
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

const DEFAULT_SERVICE_MINUTES = 60;
const MIN_SERVICE_MINUTES = 30;
const MINUTES_PER_HOUR = 60;
const ROUTE_START_MINUTES = 8 * MINUTES_PER_HOUR;
const LAST_MINUTE_OF_DAY = 23 * MINUTES_PER_HOUR + 59;
const PRE_ARRIVAL_BUFFER_MINUTES = 20;
const CONFLICT_DELAY_THRESHOLD_MINUTES = 25;
const SORT_ORDER_STEP = 10;
const UNKNOWN_DISTANCE_MILES = 4;
/** Pesos de la asignación de técnicos (distancia al centroide vs. carga). */
const SHORT_DRIVE_DISTANCE_WEIGHT = 10;
const SHORT_DRIVE_LOAD_WEIGHT = 2;
const BALANCED_DISTANCE_WEIGHT = 4;
const BALANCED_LOAD_WEIGHT = 12;
/** Pesos del vecino más cercano al ordenar las paradas de una ruta. */
const DRIVE_PENALTY_WEIGHT = 1.15;
const LATENESS_PENALTY_WEIGHT = 2;
const WAIT_PENALTY_WEIGHT = 0.1;
const SERVICE_PENALTY_WEIGHT = 0.02;
const RETURN_PENALTY_WEIGHT_FEW_REMAINING = 0.8;
const RETURN_PENALTY_WEIGHT_SOME_REMAINING = 0.45;
const RETURN_PENALTY_WEIGHT_MANY_REMAINING = 0.2;
const FEW_REMAINING_STOPS = 2;
const SOME_REMAINING_STOPS = 4;
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
  technicianId: string | null;
  planName: string | null;
  routeGroupId: string | null;
  routeGroupLabel: string | null;
  lockedTechnicianId: string | null;
  scheduledDate: Date;
  estimatedDurationMinutes: number | null;
  coordinates: GeoPoint | null;
};

export type RouteAssistantTechnician = {
  id: string;
  name: string;
};

export type RouteAssistantStopPlan = {
  jobId: string;
  customerName: string;
  address: string;
  planName: string | null;
  routeGroupId: string | null;
  routeGroupLabel: string | null;
  technicianId: string;
  technicianName: string;
  order: number;
  scheduledTime: string;
  estimatedArrivalTime: string;
  estimatedDriveMinutesFromPrevious: number;
  estimatedServiceMinutes: number;
  distanceMilesFromPrevious: number | null;
  delayMinutes: number | null;
  driveSource?: TravelMetricSource;
};

export type RouteAssistantTechnicianPlan = {
  technicianId: string;
  technicianName: string;
  originAddress: string;
  routeGroupIds: string[];
  routeGroupLabels: string[];
  stops: RouteAssistantStopPlan[];
  totalDriveMinutes: number;
  returnDriveMinutes: number;
  totalServiceMinutes: number;
  totalRouteMinutes: number;
  returnDistanceMiles: number | null;
  returnDriveSource?: TravelMetricSource;
  estimatedReturnTime: string | null;
  conflicts: number;
};

export type RouteAssistantPlan = {
  strategy: RouteAssistantStrategy;
  routes: RouteAssistantTechnicianPlan[];
  summary: {
    totalStops: number;
    totalDriveMinutes: number;
    totalServiceMinutes: number;
    totalRouteMinutes: number;
    conflicts: number;
    loadSpread: number;
  };
  updates: Array<{
    jobId: string;
    technicianId: string;
    sortOrder: number;
  }>;
};

export const DEFAULT_ROUTE_ASSISTANT_STRATEGIES: RouteAssistantStrategy[] = [
  "BALANCED",
  "SHORT_DRIVE",
  "KEEP_ASSIGNMENTS",
];

type RouteWaypoint = {
  address: string;
  coordinates: GeoPoint | null;
};

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

function toMinutesInBusinessTimezone(date: Date) {
  const parts = timePartsFormatter.formatToParts(date);
  const hourPart = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minutePart = parts.find((part) => part.type === "minute")?.value ?? "00";
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return ROUTE_START_MINUTES;
  }
  return Math.max(
    0,
    Math.min(LAST_MINUTE_OF_DAY, hour * MINUTES_PER_HOUR + minute)
  );
}

function minutesToTimeValue(minutes: number) {
  const safe = Math.max(0, Math.min(LAST_MINUTE_OF_DAY, Math.round(minutes)));
  const hours = String(Math.floor(safe / MINUTES_PER_HOUR)).padStart(2, "0");
  const mins = String(safe % MINUTES_PER_HOUR).padStart(2, "0");
  return `${hours}:${mins}`;
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

function getRouteStartMinutes(jobs: RouteAssistantJob[]) {
  const scheduledMinutes = jobs.map((job) =>
    toMinutesInBusinessTimezone(job.scheduledDate)
  );
  const earliestScheduled =
    scheduledMinutes.length > 0
      ? Math.min(...scheduledMinutes)
      : DEFAULT_SERVICE_MINUTES;
  return Math.max(
    ROUTE_START_MINUTES,
    earliestScheduled - PRE_ARRIVAL_BUFFER_MINUTES
  );
}

function simulateStop(
  cursorMinutes: number,
  driveMinutes: number,
  job: RouteAssistantJob
): StopTiming {
  const scheduledMinutes = toMinutesInBusinessTimezone(job.scheduledDate);
  const arrivalMinutes = cursorMinutes + driveMinutes;
  const serviceStartMinutes = Math.max(arrivalMinutes, scheduledMinutes);
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

function assignJobs(
  jobs: RouteAssistantJob[],
  technicians: RouteAssistantTechnician[],
  strategy: RouteAssistantStrategy
) {
  const buckets = new Map<string, RouteAssistantJob[]>();
  for (const technician of technicians) {
    buckets.set(technician.id, []);
  }

  const pool: RouteAssistantJob[] = [];
  for (const job of [...jobs].sort(sortByScheduledTime)) {
    const lockedTechnicianId =
      job.lockedTechnicianId && buckets.has(job.lockedTechnicianId)
        ? job.lockedTechnicianId
        : null;

    if (lockedTechnicianId) {
      buckets.get(lockedTechnicianId)?.push(job);
      continue;
    }

    if (strategy === "KEEP_ASSIGNMENTS" && job.technicianId && buckets.has(job.technicianId)) {
      buckets.get(job.technicianId)?.push(job);
    } else {
      pool.push(job);
    }
  }

  for (const job of pool) {
    let selectedTechnician = technicians[0];
    let bestScore = Number.POSITIVE_INFINITY;

    for (const technician of technicians) {
      const assigned = buckets.get(technician.id) ?? [];
      const assignedPoints = assigned
        .map((entry) => entry.coordinates)
        .filter((entry): entry is GeoPoint => Boolean(entry));
      const center = centroid(assignedPoints);
      const distanceMiles =
        estimateDistanceMiles(center, job.coordinates) ?? UNKNOWN_DISTANCE_MILES;
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

    buckets.get(selectedTechnician.id)?.push(job);
  }

  return buckets;
}

/**
 * Pares cuyo tiempo de viaje se solicita a travel: origen→parada, parada↔parada
 * y parada→origen. Con una sola parada quedan origen→parada y parada→origen,
 * de modo que el regreso también puede usar tráfico real.
 */
function buildTravelPairs(
  stops: RouteAssistantJob[],
  origin: RouteWaypoint
): AddressPairInput[] {
  const toPair = (from: RouteWaypoint, to: RouteWaypoint): AddressPairInput => ({
    fromAddress: from.address,
    toAddress: to.address,
    fromCoordinates: from.coordinates,
    toCoordinates: to.coordinates,
  });
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

function getReturnPenaltyWeight(remainingCount: number) {
  if (remainingCount <= FEW_REMAINING_STOPS) {
    return RETURN_PENALTY_WEIGHT_FEW_REMAINING;
  }
  if (remainingCount <= SOME_REMAINING_STOPS) {
    return RETURN_PENALTY_WEIGHT_SOME_REMAINING;
  }
  return RETURN_PENALTY_WEIGHT_MANY_REMAINING;
}

function scoreCandidate(
  pairMetrics: Map<string, TravelMetric>,
  from: RouteWaypoint,
  origin: RouteWaypoint,
  candidate: RouteAssistantJob,
  cursorMinutes: number,
  remainingCount: number
) {
  const leg = resolveLeg(pairMetrics, from, candidate);
  const timing = simulateStop(cursorMinutes, leg.driveMinutes, candidate);
  const returnLeg = resolveLeg(pairMetrics, candidate, origin);
  const latenessPenalty =
    Math.max(0, timing.serviceStartMinutes - timing.scheduledMinutes) *
    LATENESS_PENALTY_WEIGHT;
  const waitPenalty =
    Math.max(0, timing.scheduledMinutes - timing.arrivalMinutes) *
    WAIT_PENALTY_WEIGHT;
  return (
    leg.driveMinutes * DRIVE_PENALTY_WEIGHT +
    returnLeg.driveMinutes * getReturnPenaltyWeight(remainingCount) +
    latenessPenalty +
    waitPenalty +
    timing.serviceMinutes * SERVICE_PENALTY_WEIGHT
  );
}

function pickNextStopIndex(
  pairMetrics: Map<string, TravelMetric>,
  from: RouteWaypoint,
  origin: RouteWaypoint,
  remaining: RouteAssistantJob[],
  cursorMinutes: number
) {
  return remaining.reduce(
    (best, candidate, index) => {
      const score = scoreCandidate(
        pairMetrics,
        from,
        origin,
        candidate,
        cursorMinutes,
        remaining.length
      );
      return score < best.score ? { index, score } : best;
    },
    { index: 0, score: Number.POSITIVE_INFINITY }
  ).index;
}

async function orderByOptimizedRoute(
  stops: RouteAssistantJob[],
  origin: RouteWaypoint
) {
  const pairMetrics = await getTravelMetricsForPairs(
    buildTravelPairs(stops, origin)
  );
  if (stops.length <= 1) {
    return {
      orderedStops: [...stops].sort(sortByScheduledTime),
      pairMetrics,
    };
  }

  let remaining = [...stops];
  let ordered: RouteAssistantJob[] = [];
  let cursorMinutes = getRouteStartMinutes(remaining);

  while (remaining.length > 0) {
    const previous = ordered[ordered.length - 1] ?? origin;
    const nextIndex = pickNextStopIndex(
      pairMetrics,
      previous,
      origin,
      remaining,
      cursorMinutes
    );
    const next = remaining[nextIndex];
    const leg = resolveLeg(pairMetrics, previous, next);
    cursorMinutes = simulateStop(cursorMinutes, leg.driveMinutes, next).endMinutes;
    ordered = [...ordered, next];
    remaining = remaining.filter((_, index) => index !== nextIndex);
  }

  return { orderedStops: ordered, pairMetrics };
}

type Itinerary = {
  cursorMinutes: number;
  stops: RouteAssistantStopPlan[];
  totalDriveMinutes: number;
  totalServiceMinutes: number;
  conflicts: number;
};

function buildItinerary(
  technician: RouteAssistantTechnician,
  orderedStops: RouteAssistantJob[],
  origin: RouteWaypoint,
  pairMetrics: Map<string, TravelMetric>
): Itinerary {
  const initial: Itinerary = {
    cursorMinutes: getRouteStartMinutes(orderedStops),
    stops: [],
    totalDriveMinutes: 0,
    totalServiceMinutes: 0,
    conflicts: 0,
  };
  return orderedStops.reduce((acc, current, index) => {
    const previous = index > 0 ? orderedStops[index - 1] : origin;
    const leg = resolveLeg(pairMetrics, previous, current);
    const timing = simulateStop(acc.cursorMinutes, leg.driveMinutes, current);
    const delay = Math.max(0, timing.serviceStartMinutes - timing.scheduledMinutes);
    const stop: RouteAssistantStopPlan = {
      jobId: current.id,
      customerName: current.customerName,
      address: current.address,
      planName: current.planName,
      routeGroupId: current.routeGroupId,
      routeGroupLabel: current.routeGroupLabel,
      technicianId: technician.id,
      technicianName: technician.name,
      order: index + 1,
      scheduledTime: minutesToTimeValue(timing.scheduledMinutes),
      estimatedArrivalTime: minutesToTimeValue(timing.serviceStartMinutes),
      estimatedDriveMinutesFromPrevious: leg.driveMinutes,
      estimatedServiceMinutes: timing.serviceMinutes,
      distanceMilesFromPrevious:
        leg.distanceMiles == null ? null : Number(leg.distanceMiles.toFixed(2)),
      delayMinutes: delay > 0 ? delay : null,
      driveSource: leg.source,
    };
    return {
      cursorMinutes: timing.endMinutes,
      stops: [...acc.stops, stop],
      totalDriveMinutes: acc.totalDriveMinutes + leg.driveMinutes,
      totalServiceMinutes: acc.totalServiceMinutes + timing.serviceMinutes,
      conflicts:
        acc.conflicts + (delay > CONFLICT_DELAY_THRESHOLD_MINUTES ? 1 : 0),
    };
  }, initial);
}

function uniqueStrings(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
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
  const itinerary = buildItinerary(technician, orderedStops, origin, pairMetrics);

  const lastStop = orderedStops[orderedStops.length - 1] ?? null;
  const returnLeg = lastStop ? resolveLeg(pairMetrics, lastStop, origin) : null;
  const returnDriveMinutes = returnLeg?.driveMinutes ?? 0;
  const returnDistanceMiles = returnLeg?.distanceMiles ?? null;
  const totalDriveMinutes = itinerary.totalDriveMinutes + returnDriveMinutes;

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
    estimatedReturnTime:
      returnLeg && returnDriveMinutes >= 0
        ? minutesToTimeValue(itinerary.cursorMinutes + returnDriveMinutes)
        : null,
    conflicts: itinerary.conflicts,
  };
}

async function buildPlan(
  jobs: RouteAssistantJob[],
  technicians: RouteAssistantTechnician[],
  strategy: RouteAssistantStrategy,
  origin: RouteWaypoint
): Promise<RouteAssistantPlan> {
  const assignments = assignJobs(jobs, technicians, strategy);

  const technicianRoutes = await Promise.all(
    technicians.map((technician) =>
      buildTechnicianPlan(technician, assignments.get(technician.id) ?? [], origin)
    )
  );
  // El desequilibrio de carga se mide sobre TODOS los técnicos, incluidos los
  // que se quedan sin paradas; solo después se omiten las rutas vacías.
  const loadSpread = getLoadSpread(
    technicianRoutes.map((route) => route.stops.length)
  );
  const routes = technicianRoutes.filter((route) => route.stops.length > 0);

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

  const updates = routes.flatMap((route) =>
    route.stops.map((stop, index) => ({
      jobId: stop.jobId,
      technicianId: route.technicianId,
      sortOrder: (index + 1) * SORT_ORDER_STEP,
    }))
  );

  return {
    strategy,
    routes,
    summary: { ...totals, loadSpread },
    updates,
  };
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
    originAddress = DEFAULT_ROUTE_ORIGIN_ADDRESS,
    originCoordinates = null,
    strategies = DEFAULT_ROUTE_ASSISTANT_STRATEGIES,
  } = input;
  if (jobs.length === 0 || technicians.length === 0) {
    return [] as RouteAssistantPlan[];
  }

  const origin: RouteWaypoint = {
    address: originAddress,
    coordinates: originCoordinates,
  };
  const plans = await Promise.all(
    strategies.map((strategy) => buildPlan(jobs, technicians, strategy, origin))
  );
  return plans;
}
