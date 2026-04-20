import type { GeoPoint } from "@/lib/routing/geo";

const DEFAULT_DRIVE_MINUTES = 15;
const TRAVEL_CACHE_TTL_MS = 3 * 60 * 1000;
const ESTIMATED_SPEED_MPH = 27;
const TRAFFIC_FACTOR = 1.15;

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

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineMiles = (from: GeoPoint, to: GeoPoint) => {
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
};

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
  if (!Number.isFinite(distanceMiles) || distanceMiles <= 0.02) {
    return {
      durationMinutes: 0,
      distanceMiles: 0,
      source: "SAME_ADDRESS",
    };
  }

  const estimatedMinutes = Math.max(
    4,
    Math.round((distanceMiles / ESTIMATED_SPEED_MPH) * 60 * TRAFFIC_FACTOR)
  );

  return {
    durationMinutes: estimatedMinutes,
    distanceMiles: roundMiles(distanceMiles),
    source: "ESTIMATED",
  };
};

const getGoogleApiKey = () =>
  process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ?? "";

async function getGooglePairMetric(
  pair: AddressPairInput,
  apiKey: string
): Promise<TravelMetric | null> {
  const params = new URLSearchParams({
    origins: pair.fromAddress,
    destinations: pair.toAddress,
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
          }>;
        }>;
      }
    | null;

  const element = data?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    return null;
  }

  const durationSeconds = element.duration?.value;
  if (!Number.isFinite(durationSeconds)) {
    return null;
  }

  const distanceMeters = element.distance?.value;
  const distanceMiles = Number.isFinite(distanceMeters)
    ? (distanceMeters as number) / 1609.344
    : null;

  return {
    durationMinutes: Math.max(0, Math.round((durationSeconds as number) / 60)),
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

  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    setCachedMetric(key, fallback);
    return { key, metric: fallback };
  }

  const liveMetric = await getGooglePairMetric(pair, apiKey).catch(() => null);
  const resolved = liveMetric ?? fallback;
  setCachedMetric(key, resolved);
  return { key, metric: resolved };
}

export async function getTravelMetricsForPairs(pairs: AddressPairInput[]) {
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

  const queue = Array.from(uniqueByKey.values());
  const results = new Map<string, TravelMetric>();
  if (queue.length === 0) {
    return results;
  }

  const workerCount = Math.min(6, queue.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        return;
      }
      const { key, metric } = await resolveMetric(next);
      results.set(key, metric);
    }
  });

  await Promise.all(workers);
  return results;
}
