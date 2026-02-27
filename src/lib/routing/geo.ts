export type GeoPoint = {
  lat: number;
  lng: number;
};

const geocodeCache = new Map<string, GeoPoint | null>();

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
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  return { lat, lng };
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
        "User-Agent": "AcostasPool-RouteAssistant/1.0",
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

async function geocodeSingle(address: string) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim()
    ? process.env.GOOGLE_MAPS_SERVER_API_KEY
    : process.env.GOOGLE_MAPS_API_KEY?.trim()
      ? process.env.GOOGLE_MAPS_API_KEY
      : "";

  if (key) {
    const googlePoint = await geocodeWithGoogle(address, key);
    if (googlePoint) {
      return googlePoint;
    }
  }

  return geocodeWithNominatim(address);
}

export async function geocodeAddresses(addresses: string[]) {
  const unique = Array.from(
    new Set(
      addresses
        .map((address) => address.trim())
        .filter((address) => address.length > 0)
    )
  );

  const result = new Map<string, GeoPoint | null>();
  for (const address of unique) {
    const normalized = normalizeAddress(address);
    if (geocodeCache.has(normalized)) {
      result.set(address, geocodeCache.get(normalized) ?? null);
      continue;
    }
    const point = await geocodeSingle(address).catch(() => null);
    geocodeCache.set(normalized, point);
    result.set(address, point);
  }

  return result;
}
