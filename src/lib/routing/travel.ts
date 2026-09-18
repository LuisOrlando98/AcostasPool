import type { GeoPoint } from "@/lib/routing/geo";
import { getGoogleMapsServerApiKey } from "@/lib/routing/google-api-key";

export const DEFAULT_DRIVE_MINUTES = 15;
const TRAVEL_CACHE_TTL_MS = 3 * 60 * 1000;
const ESTIMATED_SPEED_MPH = 27;
const TRAFFIC_FACTOR = 1.15;
const MIN_ESTIMATED_DRIVE_MINUTES = 4;
const SAME_ADDRESS_DISTANCE_THRESHOLD_MILES = 0.02;
const EARTH_RADIUS_MILES = 3958.8;
const METERS_PER_MILE = 1609.344;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const DEGREES_PER_HALF_TURN = 180;
/** Peticiones simultáneas al Distance Matrix de Google. */
const TRAVEL_CONCURRENCY = 6;

export type TravelMetricSource =
  | "LIVE_TRAFFIC"
  | "ESTIMATED"
  | "SAME_ADDRESS";

export type TravelMetric = {
  durationMinutes: number;
  distanceMiles: number | null;
  source: TravelMetricSource;
};

export type AddressPairInput = {
  fromAddress: string;
  toAddress: string;
  fromCoordinates?: GeoPoint | null;
  toCoordinates?: GeoPoint | null;
};

type CacheEntry = {
  expiresAt: number;
  metric: TravelMetric;
};

const travelCache = new Map<string, CacheEntry>();

const normalizeAddress = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

export const getAddressPairKey = (fromAddress: string, toAddress: string) =>
  `${normalizeAddress(fromAddress)}::${normalizeAddress(toAddress)}`;

const isSameAddress = (fromAddress: string, toAddress: string) =>
  normalizeAddress(fromAddress) === normalizeAddress(toAddress);

export const toRadians = (value: number) =>
  (value * Math.PI) / DEGREES_PER_HALF_TURN;

export const haversineMiles = (from: GeoPoint, to: GeoPoint) => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
};

const estimateMinutesForMiles = (miles: number) =>
  Math.max(
    MIN_ESTIMATED_DRIVE_MINUTES,
    Math.round((miles / ESTIMATED_SPEED_MPH) * MINUTES_PER_HOUR * TRAFFIC_FACTOR)
  );

/**
 * Estimación local de conducción entre dos puntos (27 mph, factor de tráfico
 * 1.15, mínimo 4 min). Sin coordenadas devuelve DEFAULT_DRIVE_MINUTES.
 */
export function estimateDriveMinutes(
  from: GeoPoint | null,
  to: GeoPoint | null
) {
  if (!from || !to) {
    return DEFAULT_DRIVE_MINUTES;
  }
  return estimateMinutesForMiles(haversineMiles(from, to));
}

/**
 * Ejecuta `task` sobre cada elemento con como máximo `concurrency` tareas en
 * vuelo, conservando el orden de los resultados. Compartido por geo.ts y
 * travel.ts para las llamadas a proveedores externos.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const roundMiles = (value: number | null) =>
  value == null ? null : Number(value.toFixed(2));

const estimateMetric = (pair: AddressPairInput): TravelMetric => {
  if (isSameAddress(pair.fromAddress, pair.toAddress)) {
    return {
      durationMinutes: 0,
      distanceMiles: 0,
      source: "SAME_ADDRESS",
    };
  }

  const from = pair.fromCoordinates ?? null;
  const to = pair.toCoordinates ?? null;
  if (!from || !to) {
    return {
      durationMinutes: DEFAULT_DRIVE_MINUTES,
      distanceMiles: null,
      source: "ESTIMATED",
    };
  }

  const distanceMiles = haversineMiles(from, to);
  if (
    !Number.isFinite(distanceMiles) ||
    distanceMiles <= SAME_ADDRESS_DISTANCE_THRESHOLD_MILES
  ) {
    return {
      durationMinutes: 0,
      distanceMiles: 0,
      source: "SAME_ADDRESS",
    };
  }

  return {
    durationMinutes: estimateMinutesForMiles(distanceMiles),
    distanceMiles: roundMiles(distanceMiles),
    source: "ESTIMATED",
  };
};

async function getGooglePairMetric(
  pair: AddressPairInput,
  apiKey: string
): Promise<TravelMetric | null> {
  const params = new URLSearchParams({
    origins: pair.fromAddress,
    destinations: pair.toAddress,
    departure_time: "now",
    traffic_model: "best_guess",
    units: "imperial",
    region: "us",
    key: apiKey,
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
    {
      cache: "no-store",
    }
  );
  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as
    | {
        rows?: Array<{
          elements?: Array<{
            status?: string;
            distance?: { value?: number };
            duration?: { value?: number };
            duration_in_traffic?: { value?: number };
          }>;
        }>;
      }
    | null;

  const element = data?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    return null;
  }

  const durationSeconds =
    element.duration_in_traffic?.value ?? element.duration?.value;
  if (!Number.isFinite(durationSeconds)) {
    return null;
  }

  const distanceMeters = element.distance?.value;
  const distanceMiles = Number.isFinite(distanceMeters)
    ? (distanceMeters as number) / METERS_PER_MILE
    : null;

  return {
    durationMinutes: Math.max(
      0,
      Math.round((durationSeconds as number) / SECONDS_PER_MINUTE)
    ),
    distanceMiles: roundMiles(distanceMiles),
    source: "LIVE_TRAFFIC",
  };
}

const nowMs = () => Date.now();

const getCachedMetric = (key: string) => {
  const cached = travelCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= nowMs()) {
    travelCache.delete(key);
    return null;
  }
  return cached.metric;
};

const setCachedMetric = (key: string, metric: TravelMetric) => {
  travelCache.set(key, {
    metric,
    expiresAt: nowMs() + TRAVEL_CACHE_TTL_MS,
  });
};

async function resolveMetric(pair: AddressPairInput) {
  const key = getAddressPairKey(pair.fromAddress, pair.toAddress);
  const cached = getCachedMetric(key);
  if (cached) {
    return { key, metric: cached };
  }

  const fallback = estimateMetric(pair);
  if (fallback.source === "SAME_ADDRESS") {
    setCachedMetric(key, fallback);
    return { key, metric: fallback };
  }

  const apiKey = getGoogleMapsServerApiKey();
  if (!apiKey) {
    setCachedMetric(key, fallback);
    return { key, metric: fallback };
  }

  const liveMetric = await getGooglePairMetric(pair, apiKey).catch(() => null);
  const resolved = liveMetric ?? fallback;
  setCachedMetric(key, resolved);
  return { key, metric: resolved };
}

function uniquePairsByKey(pairs: AddressPairInput[]) {
  const uniqueByKey = new Map<string, AddressPairInput>();
  for (const pair of pairs) {
    if (!pair.fromAddress.trim() || !pair.toAddress.trim()) {
      continue;
    }
    const key = getAddressPairKey(pair.fromAddress, pair.toAddress);
    if (!uniqueByKey.has(key)) {
      uniqueByKey.set(key, pair);
    }
  }
  return Array.from(uniqueByKey.values());
}

export async function getTravelMetricsForPairs(pairs: AddressPairInput[]) {
  const resolved = await mapWithConcurrency(
    uniquePairsByKey(pairs),
    TRAVEL_CONCURRENCY,
    resolveMetric
  );
  return new Map(resolved.map(({ key, metric }) => [key, metric]));
}
