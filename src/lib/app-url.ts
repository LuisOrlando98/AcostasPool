const SAFE_DEFAULT_APP_URL = "https://acostaspool.com";

/**
 * `APP_URL` only gets validated for emptiness at most call sites today, not
 * for shape - if it's ever set to something like Render's internal service
 * address (e.g. "acostaspool-web:10000", reachable only on Render's private
 * network and using a port real browsers refuse to navigate to), every
 * outbound email link built from it silently breaks for every recipient.
 * This treats anything that isn't a real public http(s) host as unset.
 */
export function looksLikePublicUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return true;
    }
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

export function getPublicAppUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw && looksLikePublicUrl(raw)) {
    return raw.replace(/\/+$/, "");
  }
  return SAFE_DEFAULT_APP_URL;
}
