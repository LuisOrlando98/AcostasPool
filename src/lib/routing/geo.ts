import { prisma } from "@/lib/db";
import { getGoogleMapsServerApiKey } from "@/lib/routing/google-api-key";
import { mapWithConcurrency } from "@/lib/routing/travel";

export type GeoPoint = {
  lat: number;
  lng: number;
};

/** Propiedad con las coordenadas persistidas en la tabla Property. */
export type GeocodableProperty = {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  geocodedAt: Date | null;
};

/** Peticiones simultáneas al Geocoding API de Google. */
export const GEOCODE_CONCURRENCY = 6;
/** Nominatim exige como máximo una petición por segundo: sin key se serializa. */
export const NOMINATIM_CONCURRENCY = 1;
/** Vigencia en caché de una geocodificación resuelta. */
export const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Vigencia en caché de un fallo (null): corta para reintentar pronto. */
export const GEOCODE_FAILURE_CACHE_TTL_MS = 5 * 60 * 1000;
/** Cota de la caché en memoria; al superarla se expulsa la entrada más antigua. */
export const GEOCODE_CACHE_MAX_ENTRIES = 2000;
/** Coordenadas persistidas más antiguas que esto se vuelven a geocodificar. */
export const PERSISTED_COORDINATES_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
/** Escrituras simultáneas en Property al persistir coordenadas. */
const PERSIST_CONCURRENCY = 4;
const MAX_LATITUDE_DEGREES = 90;
const MAX_LONGITUDE_DEGREES = 180;
const NOMINATIM_USER_AGENT = "AcostasPool-RouteAssistant/1.0";

type GeocodeCacheEntry = {
  point: GeoPoint | null;
  expiresAt: number;
};

const geocodeCache = new Map<string, GeocodeCacheEntry>();

function normalizeAddress(address: string) {
  return address.trim().replace(/\s+/g, " ").toLowerCase();
}

function parsePoint(value: unknown): GeoPoint | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as { lat?: unknown; lng?: unknown };
  const lat =
    typeof candidate.lat === "number"
      ? candidate.lat
      : Number(candidate.lat ?? Number.NaN);
  const lng =
    typeof candidate.lng === "number"
      ? candidate.lng
      : Number(candidate.lng ?? Number.NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (
    Math.abs(lat) > MAX_LATITUDE_DEGREES ||
    Math.abs(lng) > MAX_LONGITUDE_DEGREES
  ) {
    return null;
  }
  return { lat, lng };
}

function readCachedEntry(key: string): GeocodeCacheEntry | null {
  const entry = geocodeCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    geocodeCache.delete(key);
    return null;
  }
  return entry;
}

function writeCachedPoint(key: string, point: GeoPoint | null) {
  geocodeCache.delete(key);
  if (geocodeCache.size >= GEOCODE_CACHE_MAX_ENTRIES) {
    const oldestKey = geocodeCache.keys().next().value;
    if (oldestKey !== undefined) {
      geocodeCache.delete(oldestKey);
    }
  }
  const ttlMs = point ? GEOCODE_CACHE_TTL_MS : GEOCODE_FAILURE_CACHE_TTL_MS;
  geocodeCache.set(key, { point, expiresAt: Date.now() + ttlMs });
}

async function geocodeWithGoogle(address: string, apiKey: string) {
  const params = new URLSearchParams({
    address,
    key: apiKey,
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    return null;
  }
  const data = (await response.json().catch(() => null)) as
    | {
        results?: Array<{
          geometry?: { location?: { lat?: number; lng?: number } };
        }>;
      }
    | null;
  const location = data?.results?.[0]?.geometry?.location;
  return parsePoint(location);
}

async function geocodeWithNominatim(address: string) {
  const params = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      cache: "no-store",
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
      },
    }
  );
  if (!response.ok) {
    return null;
  }
  const data = (await response.json().catch(() => null)) as
    | Array<{ lat?: string; lon?: string }>
    | null;
  const first = data?.[0];
  if (!first) {
    return null;
  }
  return parsePoint({
    lat: Number(first.lat ?? Number.NaN),
    lng: Number(first.lon ?? Number.NaN),
  });
}

async function geocodeSingle(address: string, apiKey: string | null) {
  if (apiKey) {
    const googlePoint = await geocodeWithGoogle(address, apiKey);
    if (googlePoint) {
      return googlePoint;
    }
  }

  return geocodeWithNominatim(address);
}

function uniqueTrimmedAddresses(addresses: string[]) {
  return Array.from(
    new Set(
      addresses
        .map((address) => address.trim())
        .filter((address) => address.length > 0)
    )
  );
}

/**
 * Separa las direcciones ya cacheadas de las que hay que consultar. Las
 * pendientes se deduplican por clave normalizada (espacios y mayúsculas) y se
 * snapshotea el valor cacheado para que no expire mientras se espera la red.
 */
function partitionByCache(addresses: string[]) {
  const cachedByKey = new Map<string, GeoPoint | null>();
  const pendingByKey = new Map<string, string>();
  for (const address of addresses) {
    const key = normalizeAddress(address);
    if (cachedByKey.has(key) || pendingByKey.has(key)) {
      continue;
    }
    const cached = readCachedEntry(key);
    if (cached) {
      cachedByKey.set(key, cached.point);
    } else {
      pendingByKey.set(key, address);
    }
  }
  return { cachedByKey, pendingByKey };
}

/**
 * Geocodifica direcciones sueltas (sin propiedad asociada) devolviendo un mapa
 * dirección recortada → coordenadas (null si no se pudo resolver).
 */
export async function geocodeAddresses(
  addresses: string[]
): Promise<Map<string, GeoPoint | null>> {
  const unique = uniqueTrimmedAddresses(addresses);
  const { cachedByKey, pendingByKey } = partitionByCache(unique);
  const apiKey = getGoogleMapsServerApiKey();
  const concurrency = apiKey ? GEOCODE_CONCURRENCY : NOMINATIM_CONCURRENCY;

  const fetched = await mapWithConcurrency(
    Array.from(pendingByKey.entries()),
    concurrency,
    async ([key, address]) => {
      const point = await geocodeSingle(address, apiKey).catch(() => null);
      writeCachedPoint(key, point);
      return [key, point] as const;
    }
  );
  const pointsByKey = new Map<string, GeoPoint | null>([
    ...cachedByKey,
    ...fetched,
  ]);

  return new Map(
    unique.map((address) => [
      address,
      pointsByKey.get(normalizeAddress(address)) ?? null,
    ])
  );
}

function uniquePropertiesById(properties: GeocodableProperty[]) {
  const byId = new Map<string, GeocodableProperty>();
  for (const property of properties) {
    if (!byId.has(property.id)) {
      byId.set(property.id, property);
    }
  }
  return Array.from(byId.values());
}

function getPersistedPoint(property: GeocodableProperty, nowMs: number) {
  const point = parsePoint({ lat: property.lat, lng: property.lng });
  if (!point) {
    return null;
  }
  const isStale =
    property.geocodedAt != null &&
    nowMs - property.geocodedAt.getTime() > PERSISTED_COORDINATES_MAX_AGE_MS;
  return isStale ? null : point;
}

async function persistPropertyCoordinates(
  entries: Array<{ id: string; point: GeoPoint }>
) {
  const geocodedAt = new Date();
  await mapWithConcurrency(entries, PERSIST_CONCURRENCY, async ({ id, point }) => {
    try {
      await prisma.property.update({
        where: { id },
        data: { lat: point.lat, lng: point.lng, geocodedAt },
      });
    } catch (error) {
      // No bloquea la planificación: las coordenadas se usan igualmente en esta
      // petición y se volverá a intentar persistirlas en la siguiente.
      console.error(`Property geocode persist failed (${id}):`, error);
    }
  });
}

/**
 * Resuelve coordenadas por propiedad usando lat/lng persistidos cuando existen
 * (y no son demasiado antiguos), geocodificando solo las que faltan y
 * persistiendo los aciertos en Property. Los fallos (null) no se persisten.
 * Devuelve un mapa id de propiedad → coordenadas (null si no se resolvió).
 */
export async function geocodeProperties(
  properties: GeocodableProperty[]
): Promise<Map<string, GeoPoint | null>> {
  const unique = uniquePropertiesById(properties);
  const nowMs = Date.now();
  const persisted = unique.flatMap((property) => {
    const point = getPersistedPoint(property, nowMs);
    return point ? [[property.id, point] as const] : [];
  });
  const persistedIds = new Set(persisted.map(([id]) => id));
  const missing = unique.filter((property) => !persistedIds.has(property.id));

  const geocoded = await geocodeAddresses(
    missing.map((property) => property.address)
  );
  const resolved = missing.map(
    (property) =>
      [property.id, geocoded.get(property.address.trim()) ?? null] as const
  );

  await persistPropertyCoordinates(
    resolved.flatMap(([id, point]) => (point ? [{ id, point }] : []))
  );

  return new Map<string, GeoPoint | null>([...persisted, ...resolved]);
}
