import { getGoogleMapsServerApiKey } from "@/lib/routing/google-api-key";

const normalizeInput = (value: string) => value.trim().replace(/\s+/g, " ");

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

  const apiKey = getGoogleMapsServerApiKey();
  if (!apiKey) {
    return normalized;
  }

  const formatted = await geocodeFormattedAddress(normalized, apiKey).catch(() => null);
  return formatted ?? normalized;
}
