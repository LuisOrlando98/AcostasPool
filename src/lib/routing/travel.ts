import type { GeoPoint } from "@/lib/routing/geo";
import { getGoogleMapsServerApiKey } from "@/lib/routing/google-api-key";

export const DEFAULT_DRIVE_MINUTES = 15;
const TRAVEL_CACHE_TTL_MS = 3 * 60 * 1000;
/** Cota de la caché en memoria: al insertar se purgan caducadas y más antiguas. */
export const TRAVEL_CACHE_MAX_ENTRIES = 5000;
const ESTIMATED_SPEED_MPH = 27;
const TRAFFIC_FACTOR = 1.15;
const MIN_ESTIMATED_DRIVE_MINUTES = 4;
const SAME_ADDRESS_DISTANCE_THRESHOLD_MILES = 0.02;
const EARTH_RADIUS_MILES = 3958.8;
const METERS_PER_MILE = 1609.344;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const DEGREES_PER_HALF_TURN = 180;
/** Peticiones simultáneas al Distance Matrix de Google (una por origen). */
const TRAVEL_CONCURRENCY = 6;
/** Destinos máximos por petición del Distance Matrix. */
const MAX_DESTINATIONS_PER_REQUEST = 25;
/** Elementos máximos (orígenes × destinos) por petición en el plan estándar. */
const MAX_ELEMENTS_PER_REQUEST = 100;
/**
 * Cada petición agrupa un único origen, así que el número de elementos coincide
 * con el de destinos y el tope efectivo es el menor de los dos límites.
 */
const MAX_DESTINATIONS_PER_BATCH = Math.min(
  MAX_DESTINATIONS_PER_REQUEST,
  MAX_ELEMENTS_PER_REQUEST
);
const DESTINATION_SEPARATOR = "|";
const DISTANCE_MATRIX_ENDPOINT =
  "https://maps.googleapis.com/maps/api/distancematrix/json";
const LOG_PREFIX = "[routing/travel]";

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

/** Par pendiente de consultar a Google, ya asociado a su clave de caché. */
type PendingPair = {
  key: string;
  pair: AddressPairInput;
};

type DistanceMatrixElement = {
  status?: string;
  distance?: { value?: number };
  duration?: { value?: number };
  duration_in_traffic?: { value?: number };
};

type DistanceMatrixResponse = {
  status?: string;
  rows?: Array<{ elements?: DistanceMatrixElement[] }>;
};

const travelCache = new Map<string, CacheEntry>();
/** Peticiones en curso por clave de par: evita duplicarlas entre llamadas. */
const inFlightMetrics = new Map<string, Promise<TravelMetric>>();

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

const purgeExpiredEntries = () => {
  const now = nowMs();
  for (const [key, entry] of travelCache) {
    if (entry.expiresAt <= now) {
      travelCache.delete(key);
    }
  }
};

/** Deja sitio para una entrada nueva: primero caducadas, luego las más antiguas. */
const evictToCapacity = () => {
  if (travelCache.size < TRAVEL_CACHE_MAX_ENTRIES) {
    return;
  }
  purgeExpiredEntries();
  while (travelCache.size >= TRAVEL_CACHE_MAX_ENTRIES) {
    const oldestKey = travelCache.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    travelCache.delete(oldestKey);
  }
};

const setCachedMetric = (key: string, metric: TravelMetric) => {
  // Reinsertar mueve la clave al final del orden de iteración del Map, de modo
  // que la expulsión por antigüedad se comporta como un LRU de escritura.
  travelCache.delete(key);
  evictToCapacity();
  travelCache.set(key, {
    metric,
    expiresAt: nowMs() + TRAVEL_CACHE_TTL_MS,
  });
};

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : "error desconocido";

/** Un aviso por lote fallido, sin direcciones ni API key. */
const logBatchFailure = (batchSize: number, reason: string) => {
  console.error(
    `${LOG_PREFIX} Distance Matrix falló (${reason}); estimación local para ${batchSize} par(es)`
  );
};

const toLiveMetric = (
  element: DistanceMatrixElement | undefined
): TravelMetric | null => {
  if (!element || element.status !== "OK") {
    return null;
  }

  const durationSeconds =
    element.duration_in_traffic?.value ?? element.duration?.value;
  if (durationSeconds === undefined || !Number.isFinite(durationSeconds)) {
    return null;
  }

  const distanceMeters = element.distance?.value;
  const distanceMiles =
    distanceMeters !== undefined && Number.isFinite(distanceMeters)
      ? distanceMeters / METERS_PER_MILE
      : null;

  return {
    durationMinutes: Math.max(
      0,
      Math.round(durationSeconds / SECONDS_PER_MINUTE)
    ),
    distanceMiles: roundMiles(distanceMiles),
    source: "LIVE_TRAFFIC",
  };
};

/**
 * Una petición por lote: un origen y hasta MAX_DESTINATIONS_PER_BATCH destinos.
 * Devuelve la fila de elementos de Google o null si el lote entero falló.
 */
async function fetchBatchElements(
  batch: readonly PendingPair[],
  apiKey: string
): Promise<DistanceMatrixElement[] | null> {
  const params = new URLSearchParams({
    origins: batch[0].pair.fromAddress,
    destinations: batch
      .map((item) => item.pair.toAddress)
      .join(DESTINATION_SEPARATOR),
    departure_time: "now",
    traffic_model: "best_guess",
    units: "imperial",
    region: "us",
    key: apiKey,
  });

  try {
    const response = await fetch(
      `${DISTANCE_MATRIX_ENDPOINT}?${params.toString()}`,
      {
        cache: "no-store",
      }
    );
    if (!response.ok) {
      logBatchFailure(batch.length, `HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as DistanceMatrixResponse | null;
    const elements = data?.rows?.[0]?.elements;
    if (!Array.isArray(elements)) {
      logBatchFailure(
        batch.length,
        `respuesta sin elementos (status=${data?.status ?? "desconocido"})`
      );
      return null;
    }
    return elements;
  } catch (error: unknown) {
    logBatchFailure(batch.length, describeError(error));
    return null;
  }
}

/**
 * Resuelve un lote y cachea cada par. El fallback es por elemento: si Google no
 * devuelve datos para un destino concreto solo ese par cae a la estimación.
 */
async function resolveBatch(
  batch: readonly PendingPair[],
  apiKey: string
): Promise<Map<string, TravelMetric>> {
  const elements = await fetchBatchElements(batch, apiKey);
  return batch.reduce((metrics, item, index) => {
    const live = elements ? toLiveMetric(elements[index]) : null;
    const metric = live ?? estimateMetric(item.pair);
    setCachedMetric(item.key, metric);
    return metrics.set(item.key, metric);
  }, new Map<string, TravelMetric>());
}

const chunkByBatchSize = (items: readonly PendingPair[]): PendingPair[][] => {
  const chunkCount = Math.ceil(items.length / MAX_DESTINATIONS_PER_BATCH);
  return Array.from({ length: chunkCount }, (_, index) =>
    items.slice(
      index * MAX_DESTINATIONS_PER_BATCH,
      (index + 1) * MAX_DESTINATIONS_PER_BATCH
    )
  );
};

/** Agrupa los pares pendientes por origen normalizado y trocea por el tope. */
const groupPendingByOrigin = (
  pending: readonly PendingPair[]
): PendingPair[][] => {
  const byOrigin = new Map<string, PendingPair[]>();
  for (const item of pending) {
    const originKey = normalizeAddress(item.pair.fromAddress);
    byOrigin.set(originKey, [...(byOrigin.get(originKey) ?? []), item]);
  }
  return Array.from(byOrigin.values()).flatMap(chunkByBatchSize);
};

/** Publica la promesa como "en vuelo" para que otras llamadas la reutilicen. */
function trackInFlight(
  key: string,
  metric: Promise<TravelMetric>
): Promise<TravelMetric> {
  const tracked: Promise<TravelMetric> = metric.finally(() => {
    if (inFlightMetrics.get(key) === tracked) {
      inFlightMetrics.delete(key);
    }
  });
  inFlightMetrics.set(key, tracked);
  return tracked;
}

/**
 * Lanza las peticiones agrupadas y devuelve una promesa por clave de par. Se
 * ejecuta de forma síncrona hasta el `fetch`, así que las entradas en vuelo
 * quedan registradas antes de que otra llamada concurrente pueda consultarlas.
 */
function startPendingBatches(
  pending: readonly PendingPair[],
  apiKey: string
): Map<string, Promise<TravelMetric>> {
  const batches = groupPendingByOrigin(pending);
  const started = new Map<string, Promise<TravelMetric>>();
  if (batches.length === 0) {
    return started;
  }

  const batchResults = mapWithConcurrency(batches, TRAVEL_CONCURRENCY, (batch) =>
    resolveBatch(batch, apiKey)
  );

  batches.forEach((batch, batchIndex) => {
    for (const item of batch) {
      const metric = batchResults.then(
        (results) => results[batchIndex].get(item.key) ?? estimateMetric(item.pair)
      );
      started.set(item.key, trackInFlight(item.key, metric));
    }
  });
  return started;
}

/** Métrica disponible sin red: caché, misma dirección o ausencia de API key. */
function resolveWithoutRequest(
  key: string,
  pair: AddressPairInput,
  apiKey: string | null
): TravelMetric | null {
  const cached = getCachedMetric(key);
  if (cached) {
    return cached;
  }

  const fallback = estimateMetric(pair);
  if (apiKey && fallback.source !== "SAME_ADDRESS") {
    return null;
  }
  setCachedMetric(key, fallback);
  return fallback;
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

/** Reparte los pares únicos entre resueltos, ya en vuelo y pendientes de red. */
function planResolution(
  pairs: AddressPairInput[],
  apiKey: string | null
): Array<{ key: string; metric: Promise<TravelMetric> }> {
  const keyed = uniquePairsByKey(pairs).map((pair) => ({
    key: getAddressPairKey(pair.fromAddress, pair.toAddress),
    pair,
  }));

  const ready = new Map<string, Promise<TravelMetric>>();
  const pending: PendingPair[] = [];
  for (const entry of keyed) {
    const resolved = resolveWithoutRequest(entry.key, entry.pair, apiKey);
    if (resolved) {
      ready.set(entry.key, Promise.resolve(resolved));
      continue;
    }
    const inFlight = inFlightMetrics.get(entry.key);
    if (inFlight) {
      ready.set(entry.key, inFlight);
      continue;
    }
    pending.push(entry);
  }

  // `pending` solo se llena cuando hay API key, pero el tipo no lo garantiza.
  const started = apiKey
    ? startPendingBatches(pending, apiKey)
    : new Map<string, Promise<TravelMetric>>();

  return keyed.map(({ key, pair }) => ({
    key,
    metric:
      ready.get(key) ?? started.get(key) ?? Promise.resolve(estimateMetric(pair)),
  }));
}

export async function getTravelMetricsForPairs(
  pairs: AddressPairInput[]
): Promise<Map<string, TravelMetric>> {
  const planned = planResolution(pairs, getGoogleMapsServerApiKey());
  const entries = await Promise.all(
    planned.map(async ({ key, metric }) => [key, await metric] as const)
  );
  return new Map(entries);
}
