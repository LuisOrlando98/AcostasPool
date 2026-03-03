import { BUSINESS_TIMEZONE } from "@/lib/jobs/capacity";
import type { GeoPoint } from "@/lib/routing/geo";
import {
  getAddressPairKey,
  getTravelMetricsForPairs,
  type TravelMetricSource,
} from "@/lib/routing/travel";

const DEFAULT_SERVICE_MINUTES = 60;
const DEFAULT_DRIVE_MINUTES = 15;

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
  stops: RouteAssistantStopPlan[];
  totalDriveMinutes: number;
  totalServiceMinutes: number;
  totalRouteMinutes: number;
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

function isSameAddress(fromAddress: string, toAddress: string) {
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();
  return normalize(fromAddress) === normalize(toAddress);
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
  if (strategy === "KEEP_ASSIGNMENTS") {
    for (const job of [...jobs].sort(sortByScheduledTime)) {
      if (job.technicianId && buckets.has(job.technicianId)) {
        buckets.get(job.technicianId)?.push(job);
      } else {
        pool.push(job);
      }
    }
  } else {
    pool.push(...[...jobs].sort(sortByScheduledTime));
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

function orderByNearestNeighbor(stops: RouteAssistantJob[]) {
  if (stops.length <= 2) {
    return [...stops].sort(sortByScheduledTime);
  }

  const remaining = [...stops];
  const seedIndex = remaining.reduce((bestIndex, current, index, list) => {
    if (list[bestIndex] == null) {
      return index;
    }
    return current.scheduledDate.getTime() < list[bestIndex].scheduledDate.getTime()
      ? index
      : bestIndex;
  }, 0);

  const ordered: RouteAssistantJob[] = [];
  const [seed] = remaining.splice(seedIndex, 1);
  if (!seed) {
    return stops;
  }
  ordered.push(seed);

  while (remaining.length > 0) {
    const previous = ordered[ordered.length - 1] ?? null;
    let nextIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distance = previous
        ? isSameAddress(previous.address, candidate.address)
          ? 0
          : estimateDistanceMiles(previous.coordinates, candidate.coordinates) ?? 9999
        : 9999;
      if (distance < bestDistance) {
        bestDistance = distance;
        nextIndex = index;
      }
    }

    const [next] = remaining.splice(nextIndex, 1);
    if (next) {
      ordered.push(next);
    }
  }

  return ordered;
}

async function buildTechnicianPlan(
  technician: RouteAssistantTechnician,
  assignedJobs: RouteAssistantJob[]
): Promise<RouteAssistantTechnicianPlan> {
  const orderedStops = orderByNearestNeighbor(assignedJobs);
  const pairMetrics = await getTravelMetricsForPairs(
    orderedStops.slice(1).map((current, index) => {
      const previous = orderedStops[index];
      return {
        fromAddress: previous.address,
        toAddress: current.address,
        fromCoordinates: previous.coordinates,
        toCoordinates: current.coordinates,
      };
    })
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
    const travelMetric =
      previous && current
        ? pairMetrics.get(getAddressPairKey(previous.address, current.address))
        : null;
    const driveMinutes =
      index === 0
        ? 0
        : travelMetric?.durationMinutes ??
          estimateDriveMinutes(previous?.coordinates ?? null, current.coordinates);
    const distanceMiles =
      index === 0
        ? null
        : travelMetric?.distanceMiles ??
          estimateDistanceMiles(previous?.coordinates ?? null, current.coordinates);

    cursorMinutes += driveMinutes;
    const arrival = cursorMinutes;
    const scheduled = toMinutesInBusinessTimezone(current.scheduledDate);
    const delay = Math.max(0, arrival - scheduled);
    if (delay > 25) {
      conflicts += 1;
    }

    const serviceMinutes = Math.max(
      30,
      current.estimatedDurationMinutes ?? DEFAULT_SERVICE_MINUTES
    );
    cursorMinutes += serviceMinutes;

    totalDriveMinutes += driveMinutes;
    totalServiceMinutes += serviceMinutes;

    stops.push({
      jobId: current.id,
      customerName: current.customerName,
      address: current.address,
      technicianId: technician.id,
      technicianName: technician.name,
      order: index + 1,
      scheduledTime: minutesToTimeValue(scheduled),
      estimatedArrivalTime: minutesToTimeValue(arrival),
      estimatedDriveMinutesFromPrevious: driveMinutes,
      estimatedServiceMinutes: serviceMinutes,
      distanceMilesFromPrevious:
        distanceMiles == null ? null : Number(distanceMiles.toFixed(2)),
      delayMinutes: delay > 0 ? delay : null,
      driveSource: index === 0 ? undefined : travelMetric?.source ?? "ESTIMATED",
    });
  }

  return {
    technicianId: technician.id,
    technicianName: technician.name,
    stops,
    totalDriveMinutes,
    totalServiceMinutes,
    totalRouteMinutes: totalDriveMinutes + totalServiceMinutes,
    conflicts,
  };
}

async function buildPlan(
  jobs: RouteAssistantJob[],
  technicians: RouteAssistantTechnician[],
  strategy: RouteAssistantStrategy
): Promise<RouteAssistantPlan> {
  const assignments = assignJobs(jobs, technicians, strategy);

  const routes = (
    await Promise.all(
      technicians.map((technician) => {
      const assignedJobs = assignments.get(technician.id) ?? [];
      return buildTechnicianPlan(technician, assignedJobs);
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
}) {
  const { jobs, technicians } = input;
  if (jobs.length === 0 || technicians.length === 0) {
    return [] as RouteAssistantPlan[];
  }

  const plans = await Promise.all([
    buildPlan(jobs, technicians, "BALANCED"),
    buildPlan(jobs, technicians, "SHORT_DRIVE"),
    buildPlan(jobs, technicians, "KEEP_ASSIGNMENTS"),
  ]);
  return plans;
}
