import { LOCALE_COOKIE } from "@/i18n/config";

export type LandingTheme = "ocean" | "night";
export type LandingLocale = "en" | "es";

export const LANDING_THEME_STORAGE_KEY = "ap:landing-theme-v4";
export const LANDING_LOCALE_STORAGE_KEY = "ap:landing-locale-v1";
export const LANDING_LOCALE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function resolveLandingLocale(raw?: string | null): LandingLocale {
  return raw?.toLowerCase() === "es" ? "es" : "en";
}

export function resolveLandingTheme(raw?: string | null): LandingTheme {
  return raw === "night" ? "night" : "ocean";
}

export function readBrowserCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((token) => token.trim())
    .find((token) => token.startsWith(prefix));
  return cookie ? cookie.slice(prefix.length) : null;
}

export function getInitialLandingLocale(): LandingLocale {
  if (typeof window === "undefined") {
    return "en";
  }

  const cookieLocale = readBrowserCookie(LOCALE_COOKIE);
  if (cookieLocale) {
    return resolveLandingLocale(cookieLocale);
  }

  const storedLocale = window.localStorage.getItem(LANDING_LOCALE_STORAGE_KEY);
  if (storedLocale === "en" || storedLocale === "es") {
    return storedLocale;
  }

  return resolveLandingLocale(document.documentElement.lang);
}

export function getInitialLandingTheme(): LandingTheme {
  if (typeof window === "undefined") {
    return "ocean";
  }
  return resolveLandingTheme(window.localStorage.getItem(LANDING_THEME_STORAGE_KEY));
}
