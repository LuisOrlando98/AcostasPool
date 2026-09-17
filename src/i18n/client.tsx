"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/i18n/config";
import type { Messages, TranslatePluralFn, Translator } from "@/i18n/translate";
import { createTranslator } from "@/i18n/translate";

type I18nContextValue = {
  locale: Locale;
  /** `t(key, values)`; también expone `t.plural(...)`. */
  t: Translator;
  /** `tPlural(key, count, values)`: resuelve `${key}.one` / `${key}.other`. */
  tPlural: TranslatePluralFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const t = useMemo(() => createTranslator(messages), [messages]);
  const value = useMemo<I18nContextValue>(
    () => ({ locale, t, tPlural: t.plural }),
    [locale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
