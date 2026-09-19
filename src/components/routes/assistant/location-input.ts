/**
 * Validación pura de los campos del modal "Corregir ubicación". Los mismos
 * límites que el endpoint `PATCH /api/admin/properties/[id]/location`, para
 * avisar antes de gastar una petición. Se prueba en
 * `tests/unit/components/routes-assistant/location-input.test.ts`.
 */

export const MIN_ADDRESS_LENGTH = 5;
export const MAX_ADDRESS_LENGTH = 200;
export const MAX_LATITUDE = 90;
export const MAX_LONGITUDE = 180;

const MAPS_SEARCH_URL = "https://www.google.com/maps/search/?api=1&query=";
/** Solo notación decimal: "1e2" o "25.76N" son errores de copiado, no números. */
const DECIMAL_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)$/;
/** Google Maps copia "25.7617, -80.1918"; a veces se pega solo con espacios. */
const PAIR_SEPARATOR = /[,\s]+/;
const PAIR_LENGTH = 2;

export type Coordinates = {
  readonly lat: number;
  readonly lng: number;
};

export function isValidAddress(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= MIN_ADDRESS_LENGTH && trimmed.length <= MAX_ADDRESS_LENGTH
  );
}

function toDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

const inRange = (value: number, limit: number): boolean =>
  value >= -limit && value <= limit;

/** Par de coordenadas válido, o `null` si falta alguna o se sale del rango. */
export function parseCoordinates(lat: string, lng: string): Coordinates | null {
  const parsedLat = toDecimal(lat);
  const parsedLng = toDecimal(lng);
  if (parsedLat === null || parsedLng === null) {
    return null;
  }
  if (!inRange(parsedLat, MAX_LATITUDE) || !inRange(parsedLng, MAX_LONGITUDE)) {
    return null;
  }
  return { lat: parsedLat, lng: parsedLng };
}

/** "25.7617, -80.1918" pegado de Google Maps en un solo campo. */
export function parseCoordinatePair(value: string): Coordinates | null {
  const parts = value.trim().split(PAIR_SEPARATOR);
  if (parts.length !== PAIR_LENGTH) {
    return null;
  }
  return parseCoordinates(parts[0], parts[1]);
}

/** Buscador de Google Maps con la dirección, para copiar las coordenadas. */
export function buildMapsSearchUrl(address: string): string {
  return `${MAPS_SEARCH_URL}${encodeURIComponent(address)}`;
}
