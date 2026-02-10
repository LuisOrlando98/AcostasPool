export const locales = ["en", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const LOCALE_COOKIE = "ap_locale";

export function normalizeLocale(value?: string | null): Locale {
  if (!value) {
    return defaultLocale;
  }
  const normalized = value.toLowerCase();
  if (normalized === "en") {
    return "en";
  }
  if (normalized === "es") {
    return "es";
  }
  return defaultLocale;
}
