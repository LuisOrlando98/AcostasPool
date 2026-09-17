"use client";

import type { ComponentType } from "react";
import { getLandingShellCopy } from "@/components/landing/landing-copy";
import type { LandingLocale, LandingTheme } from "@/components/landing/preferences";

export function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20.1 14.8A8.7 8.7 0 1 1 9.2 3.9a7 7 0 1 0 10.9 10.9Z" />
    </svg>
  );
}

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: LandingLocale; text: string }> = [
  { value: "en", text: "EN" },
  { value: "es", text: "ES" },
];

const THEME_OPTIONS: ReadonlyArray<{ value: LandingTheme; Icon: ComponentType }> = [
  { value: "ocean", Icon: SunIcon },
  { value: "night", Icon: MoonIcon },
];

export function LanguageSwitch({
  language,
  onChange,
  groupLabel,
  className = "lp-lang-switch",
}: {
  language: LandingLocale;
  onChange?: (locale: LandingLocale) => void;
  groupLabel?: string;
  /** Container class. Defaults to the standard pill; the header passes a compact variant on mobile. */
  className?: string;
}) {
  const copy = getLandingShellCopy(language).language;
  const labels: Record<LandingLocale, string> = { en: copy.english, es: copy.spanish };

  return (
    <div className={className} role="group" aria-label={groupLabel ?? copy.label}>
      {LANGUAGE_OPTIONS.map((option) => {
        const active = language === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className="lp-lang-btn"
            data-active={active}
            aria-pressed={active}
            aria-label={labels[option.value]}
            title={labels[option.value]}
            onClick={() => onChange?.(option.value)}
          >
            {option.text}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeSwitch({
  theme,
  language,
  onChange,
  labels,
}: {
  theme: LandingTheme;
  language: LandingLocale;
  onChange?: (theme: LandingTheme) => void;
  labels?: {
    group?: string;
    light?: string;
    dark?: string;
  };
}) {
  const copy = getLandingShellCopy(language).theme;
  const resolvedLabels: Record<LandingTheme, string> = {
    ocean: labels?.light ?? copy.light,
    night: labels?.dark ?? copy.dark,
  };

  return (
    <div className="lp-theme-switch" role="group" aria-label={labels?.group ?? copy.label}>
      {THEME_OPTIONS.map(({ value, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            className="lp-theme-btn"
            data-active={active}
            aria-pressed={active}
            aria-label={resolvedLabels[value]}
            title={resolvedLabels[value]}
            onClick={() => onChange?.(value)}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
