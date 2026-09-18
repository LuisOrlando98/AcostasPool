/**
 * Única fuente de verdad para la API key de Google Maps usada desde el
 * servidor (geocoding, distance matrix, normalización de direcciones).
 *
 * Orden de preferencia: GOOGLE_MAPS_SERVER_API_KEY y, como respaldo,
 * GOOGLE_MAPS_API_KEY. El valor se recorta y una key vacía o compuesta solo
 * por espacios se considera ausente.
 */
const GOOGLE_MAPS_API_KEY_ENV_NAMES = [
  "GOOGLE_MAPS_SERVER_API_KEY",
  "GOOGLE_MAPS_API_KEY",
] as const;

export function getGoogleMapsServerApiKey(): string | null {
  for (const envName of GOOGLE_MAPS_API_KEY_ENV_NAMES) {
    const value = process.env[envName]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}
