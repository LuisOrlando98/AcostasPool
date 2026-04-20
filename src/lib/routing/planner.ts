import { BUSINESS_TIMEZONE } from "@/lib/jobs/capacity";
import type { GeoPoint } from "@/lib/routing/geo";
import {
  getAddressPairKey,
  getTravelMetricsForPairs,
  type TravelMetricSource,
} from "@/lib/routing/travel";

const DEFAULT_SERVICE_MINUTES = 60;
const DEFAULT_DRIVE_MINUTES = 15;
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

function toMinutesInBusinessTimezone(date: Date) {
  const parts = timePartsFormatter.formatToParts(date);
  const hourPart = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minutePart = parts.find((part) => part.type === "minute")?.value ?? "00";
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 8 * 60;
  }
  return Math.max(0, Math.min(23 * 60 + 59, hour * 60 + minute));
}

function minutesToTimeValue(minutes: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hours = String(Math.floor(safe / 60)).padStart(2, "0");
  const mins = String(safe % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMiles(from: GeoPoint, to: GeoPoint) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function estimateDistanceMiles(from: GeoPoint | null, to: GeoPoint | null) {
  if (!from || !to) {
    return null;
  }
  return haversineMiles(from, to);
}

function estimateDriveMinutes(from: GeoPoint | null, to: GeoPoint | null) {
  const miles = estimateDistanceMiles(from, to);
  if (miles == null) {
    return DEFAULT_DRIVE_MINUTES;
  }
  const averageSpeedMph = 27;
  const trafficFactor = 1.15;
  const minutes = (miles / averageSpeedMph) * 60 * trafficFactor;
  return Math.max(4, Math.round(minutes));
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
      const distanceMiles = estimateDistanceMiles(center, job.coordinates) ?? 4;
      const load = assigned.length;

      const score =
        strategy === "SHORT_DRIVE"
          ? distanceMiles * 10 + load * 2
          : distanceMiles * 4 + load * 12;

      if (score < bestScore) {
        bestScore = score;
        selectedTechnician = technician;
      }
    }

    buckets.get(selectedTechnician.id)?.push(job);
  }

  return buckets;
}

async function orderByOptimizedRoute(
  stops: RouteAssistantJob[],
  originAddress: string,
  originCoordinates: GeoPoint | null
) {
  if (stops.length <= 1) {
    return {
      orderedStops: [...stops].sort(sortByScheduledTime),
      pairMetrics: await getTravelMetricsForPairs(
        stops.map((stop) => ({
          fromAddress: originAddress,
          toAddress: stop.address,
          fromCoordinates: originCoordinates,
          toCoordinates: stop.coordinates,
        }))
      ),
    };
  }

  const pairMetrics = await getTravelMetricsForPairs([
    ...stops.map((stop) => ({
      fromAddress: originAddress,
      toAddress: stop.address,
      fromCoordinates: originCoordinates,
      toCoordinates: stop.coordinates,
    })),
    ...stops.flatMap((fromStop) =>
      stops
        .filter((toStop) => toStop.id !== fromStop.id)
        .map((toStop) => ({
          fromAddress: fromStop.address,
          toAddress: toStop.address,
          fromCoordinates: fromStop.coordinates,
          toCoordinates: toStop.coordinates,
        }))
    ),
    ...stops.map((stop) => ({
      fromAddress: stop.address,
      toAddress: originAddress,
      fromCoordinates: stop.coordinates,
      toCoordinates: originCoordinates,
    })),
  ]);

  const remaining = [...stops];
  const ordered: RouteAssistantJob[] = [];
  const earliestScheduled = Math.min(
    ...remaining.map((candidate) => toMinutesInBusinessTimezone(candidate.scheduledDate))
  );
  let cursorMinutes = Math.max(8 * 60, earliestScheduled - 20);

  while (remaining.length > 0) {
    const previous = ordered[ordered.length - 1] ?? null;
    let nextIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const fromAddress = previous?.address ?? originAddress;
      const fromCoordinates = previous?.coordinates ?? originCoordinates;
      const metric = pairMetrics.get(getAddressPairKey(fromAddress, candidate.address));
      const driveMinutes =
        metric?.durationMinutes ??
        estimateDriveMinutes(fromCoordinates, candidate.coordinates);
      const scheduledMinutes = toMinutesInBusinessTimezone(candidate.scheduledDate);
      const arrivalMinutes = cursorMinutes + driveMinutes;
      const serviceStartMinutes = Math.max(arrivalMinutes, scheduledMinutes);
      const serviceMinutes = Math.max(
        30,
        candidate.estimatedDurationMinutes ?? DEFAULT_SERVICE_MINUTES
      );
      const returnMetric = pairMetrics.get(
        getAddressPairKey(candidate.address, originAddress)
      );
      const returnDriveMinutes =
        returnMetric?.durationMinutes ??
        estimateDriveMinutes(candidate.coordinates, originCoordinates);
      const latenessPenalty = Math.max(0, serviceStartMinutes - scheduledMinutes) * 2;
      const waitPenalty = Math.max(0, scheduledMinutes - arrivalMinutes) * 0.1;
      const durationPenalty = driveMinutes * 1.15;
      const remainingCount = remaining.length;
      const returnPenaltyWeight =
        remainingCount <= 2 ? 0.8 : remainingCount <= 4 ? 0.45 : 0.2;
      const score =
        durationPenalty +
        returnDriveMinutes * returnPenaltyWeight +
        latenessPenalty +
        waitPenalty +
        serviceMinutes * 0.02;

      if (score < bestScore) {
        bestScore = score;
        nextIndex = index;
      }
    }

    const [next] = remaining.splice(nextIndex, 1);
    if (next) {
      const fromAddress = ordered[ordered.length - 1]?.address ?? originAddress;
      const fromCoordinates =
        ordered[ordered.length - 1]?.coordinates ?? originCoordinates;
      const metric = pairMetrics.get(getAddressPairKey(fromAddress, next.address));
      const driveMinutes =
        metric?.durationMinutes ??
        estimateDriveMinutes(fromCoordinates, next.coordinates);
      const scheduledMinutes = toMinutesInBusinessTimezone(next.scheduledDate);
      const arrivalMinutes = cursorMinutes + driveMinutes;
      const serviceStartMinutes = Math.max(arrivalMinutes, scheduledMinutes);
      const serviceMinutes = Math.max(
        30,
        next.estimatedDurationMinutes ?? DEFAULT_SERVICE_MINUTES
      );
      cursorMinutes = serviceStartMinutes + serviceMinutes;
      ordered.push(next);
    }
  }

  return { orderedStops: ordered, pairMetrics };
}

async function buildTechnicianPlan(
  technician: RouteAssistantTechnician,
  assignedJobs: RouteAssistantJob[],
  originAddress: string,
  originCoordinates: GeoPoint | null
): Promise<RouteAssistantTechnicianPlan> {
  const { orderedStops, pairMetrics } = await orderByOptimizedRoute(
    assignedJobs,
    originAddress,
    originCoordinates
  );
  const scheduledMinutes = orderedStops.map((job) =>
    toMinutesInBusinessTimezone(job.scheduledDate)
  );
  const earliestScheduled =
    scheduledMinutes.length > 0
      ? Math.min(...scheduledMinutes)
      : DEFAULT_SERVICE_MINUTES;

  let cursorMinutes = Math.max(8 * 60, earliestScheduled - 20);
  let totalDriveMinutes = 0;
  let totalServiceMinutes = 0;
  let conflicts = 0;

  const stops: RouteAssistantStopPlan[] = [];
  for (let index = 0; index < orderedStops.length; index += 1) {
    const current = orderedStops[index];
    const previous = index > 0 ? orderedStops[index - 1] : null;
    const travelMetric = pairMetrics.get(
      getAddressPairKey(previous?.address ?? originAddress, current.address)
    );
    const driveMinutes =
      travelMetric?.durationMinutes ??
      estimateDriveMinutes(
        previous?.coordinates ?? originCoordinates,
        current.coordinates
      );
    const distanceMiles =
      travelMetric?.distanceMiles ??
      estimateDistanceMiles(
        previous?.coordinates ?? originCoordinates,
        current.coordinates
      );

    cursorMinutes += driveMinutes;
    const arrival = cursorMinutes;
    const scheduled = toMinutesInBusinessTimezone(current.scheduledDate);
    const serviceStart = Math.max(arrival, scheduled);
    const delay = Math.max(0, serviceStart - scheduled);
    if (delay > 25) {
      conflicts += 1;
    }

    const serviceMinutes = Math.max(
      30,
      current.estimatedDurationMinutes ?? DEFAULT_SERVICE_MINUTES
    );
    cursorMinutes = serviceStart + serviceMinutes;

    totalDriveMinutes += driveMinutes;
    totalServiceMinutes += serviceMinutes;

    stops.push({
      jobId: current.id,
      customerName: current.customerName,
      address: current.address,
      planName: current.planName,
      routeGroupId: current.routeGroupId,
      routeGroupLabel: current.routeGroupLabel,
      technicianId: technician.id,
      technicianName: technician.name,
      order: index + 1,
      scheduledTime: minutesToTimeValue(scheduled),
      estimatedArrivalTime: minutesToTimeValue(serviceStart),
      estimatedDriveMinutesFromPrevious: driveMinutes,
      estimatedServiceMinutes: serviceMinutes,
      distanceMilesFromPrevious:
        distanceMiles == null ? null : Number(distanceMiles.toFixed(2)),
      delayMinutes: delay > 0 ? delay : null,
      driveSource: travelMetric?.source ?? "ESTIMATED",
    });
  }

  const lastStop = orderedStops[orderedStops.length - 1] ?? null;
  const returnMetric = lastStop
    ? pairMetrics.get(getAddressPairKey(lastStop.address, originAddress))
    : null;
  const returnDriveMinutes = lastStop
    ? returnMetric?.durationMinutes ??
      estimateDriveMinutes(lastStop.coordinates, originCoordinates)
    : 0;
  const returnDistanceMiles = lastStop
    ? returnMetric?.distanceMiles ??
      estimateDistanceMiles(lastStop.coordinates, originCoordinates)
    : null;
  const estimatedReturnTime =
    lastStop && returnDriveMinutes >= 0
      ? minutesToTimeValue(cursorMinutes + returnDriveMinutes)
      : null;
  totalDriveMinutes += returnDriveMinutes;

  return {
    technicianId: technician.id,
    technicianName: technician.name,
    originAddress,
    routeGroupIds: Array.from(
      new Set(
        stops
          .map((stop) => stop.routeGroupId)
          .filter((value): value is string => Boolean(value))
      )
    ),
    routeGroupLabels: Array.from(
      new Set(
        stops
          .map((stop) => stop.routeGroupLabel)
          .filter((value): value is string => Boolean(value))
      )
    ),
    stops,
    totalDriveMinutes,
    returnDriveMinutes,
    totalServiceMinutes,
    totalRouteMinutes: totalDriveMinutes + totalServiceMinutes,
    returnDistanceMiles:
      returnDistanceMiles == null ? null : Number(returnDistanceMiles.toFixed(2)),
    returnDriveSource: returnMetric?.source ?? (lastStop ? "ESTIMATED" : undefined),
    estimatedReturnTime,
    conflicts,
  };
}

async function buildPlan(
  jobs: RouteAssistantJob[],
  technicians: RouteAssistantTechnician[],
  strategy: RouteAssistantStrategy,
  originAddress: string,
  originCoordinates: GeoPoint | null
): Promise<RouteAssistantPlan> {
  const assignments = assignJobs(jobs, technicians, strategy);

  const routes = (
    await Promise.all(
      technicians.map((technician) => {
        const assignedJobs = assignments.get(technician.id) ?? [];
        return buildTechnicianPlan(
          technician,
          assignedJobs,
          originAddress,
          originCoordinates
        );
      })
    )
  ).filter((route) => route.stops.length > 0);

  const totals = routes.reduce(
    (acc, route) => {
      acc.totalStops += route.stops.length;
      acc.totalDriveMinutes += route.totalDriveMinutes;
      acc.totalServiceMinutes += route.totalServiceMinutes;
      acc.totalRouteMinutes += route.totalRouteMinutes;
      acc.conflicts += route.conflicts;
      return acc;
    },
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
      sortOrder: (index + 1) * 10,
    }))
  );

  return {
    strategy,
    routes,
    summary: {
      ...totals,
      loadSpread: getLoadSpread(routes.map((route) => route.stops.length)),
    },
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

  const plans = await Promise.all(
    strategies.map((strategy) =>
      buildPlan(jobs, technicians, strategy, originAddress, originCoordinates)
    )
  );
  return plans;
}
