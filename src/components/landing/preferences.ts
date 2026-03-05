export type LandingTheme = "ocean" | "night";
export type LandingLocale = "en" | "es";

export const LANDING_THEME_STORAGE_KEY = "ap:landing-theme-v4";
export const LANDING_LOCALE_STORAGE_KEY = "ap:landing-locale-v1";

export function resolveLandingLocale(raw?: string | null): LandingLocale {
  return raw?.toLowerCase() === "es" ? "es" : "en";
}

export function resolveLandingTheme(raw?: string | null): LandingTheme {
  return raw === "night" ? "night" : "ocean";
}

export function getInitialLandingLocale(): LandingLocale {
  if (typeof window === "undefined") {
    return "en";
  }

  const storedLocale = window.localStorage.getItem(LANDING_LOCALE_STORAGE_KEY);
  if (storedLocale === "en" || storedLocale === "es") {
    return storedLocale;
  }

  return "en";
}

export function getInitialLandingTheme(): LandingTheme {
  if (typeof window === "undefined") {
    return "ocean";
  }
  return resolveLandingTheme(window.localStorage.getItem(LANDING_THEME_STORAGE_KEY));
}
