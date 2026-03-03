const normalizeInput = (value: string) => value.trim().replace(/\s+/g, " ");

function getGoogleApiKey() {
  if (process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim()) {
    return process.env.GOOGLE_MAPS_SERVER_API_KEY.trim();
  }
  if (process.env.GOOGLE_MAPS_API_KEY?.trim()) {
    return process.env.GOOGLE_MAPS_API_KEY.trim();
  }
  return "";
}

type GoogleGeocodeResult = {
  formatted_address?: string;
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: GoogleGeocodeResult[];
};

async function geocodeFormattedAddress(address: string, apiKey: string) {
  const params = new URLSearchParams({
    address,
    key: apiKey,
    region: "us",
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    {
      cache: "no-store",
    }
  );
  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as GoogleGeocodeResponse | null;
  const formatted = data?.results?.[0]?.formatted_address;
  if (typeof formatted !== "string") {
    return null;
  }
  const normalized = normalizeInput(formatted);
  return normalized || null;
}

export async function normalizePropertyAddress(address: string) {
  const normalized = normalizeInput(address);
  if (!normalized) {
    return "";
  }

  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    return normalized;
  }

  const formatted = await geocodeFormattedAddress(normalized, apiKey).catch(() => null);
  return formatted ?? normalized;
}
