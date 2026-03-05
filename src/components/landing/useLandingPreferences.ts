"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  LANDING_LOCALE_STORAGE_KEY,
  LANDING_THEME_STORAGE_KEY,
  getInitialLandingLocale,
  getInitialLandingTheme,
  type LandingLocale,
  type LandingTheme,
  resolveLandingLocale,
  resolveLandingTheme,
} from "@/components/landing/preferences";

function syncFromBrowserSources(
  setLanguage: Dispatch<SetStateAction<LandingLocale>>,
  setTheme: Dispatch<SetStateAction<LandingTheme>>
) {
  const nextLanguage = getInitialLandingLocale();
  const nextTheme = getInitialLandingTheme();

  setLanguage((current) => (current === nextLanguage ? current : nextLanguage));
  setTheme((current) => (current === nextTheme ? current : nextTheme));
}

export function useLandingPreferences() {
  const [language, setLanguage] = useState<LandingLocale>(() => getInitialLandingLocale());
  const [theme, setTheme] = useState<LandingTheme>(() => getInitialLandingTheme());

  useEffect(() => {
    window.localStorage.setItem(LANDING_THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(LANDING_LOCALE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }

      if (event.key === LANDING_THEME_STORAGE_KEY && event.newValue) {
        const nextTheme = resolveLandingTheme(event.newValue);
        setTheme((current) => (current === nextTheme ? current : nextTheme));
      }

      if (event.key === LANDING_LOCALE_STORAGE_KEY && event.newValue) {
        const nextLanguage = resolveLandingLocale(event.newValue);
        setLanguage((current) => (current === nextLanguage ? current : nextLanguage));
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        syncFromBrowserSources(setLanguage, setTheme);
      }
    };

    const onFocus = () => {
      syncFromBrowserSources(setLanguage, setTheme);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return { language, setLanguage, theme, setTheme };
}
