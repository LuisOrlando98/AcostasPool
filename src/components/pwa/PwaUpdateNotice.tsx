"use client";

import { normalizeLocale, type Locale } from "@/i18n/config";
import { getShellTranslator } from "@/i18n/shell-messages";

export type PwaUpdateLabels = {
  readonly title: string;
  readonly reload: string;
  readonly dismiss: string;
};

/**
 * `PwaRegister` se monta fuera de `I18nProvider` (ver `app/layout.tsx`), así
 * que el locale se lee de `<html lang>` (que el layout fija con la misma
 * cookie) y las etiquetas `pwa.update.*` salen del subconjunto síncrono de
 * `@/i18n/shell-messages`: son 3 cadenas por idioma, mucho más ligeras que
 * cargar el diccionario completo en el bundle cliente, y `getPwaUpdateLabels`
 * sigue siendo síncrona para `PwaRegister`.
 */
export function readDocumentLocale(): Locale {
  if (typeof document === "undefined") {
    return normalizeLocale(null);
  }
  return normalizeLocale(document.documentElement.lang);
}

export function getPwaUpdateLabels(locale: Locale): PwaUpdateLabels {
  const t = getShellTranslator(locale);
  return {
    title: t("pwa.update.title"),
    reload: t("pwa.update.reload"),
    dismiss: t("pwa.update.dismiss"),
  };
}

type PwaUpdateNoticeProps = {
  readonly labels: PwaUpdateLabels;
  readonly onReload: () => void;
  readonly onDismiss: () => void;
};

export default function PwaUpdateNotice({
  labels,
  onReload,
  onDismiss,
}: PwaUpdateNoticeProps) {
  return (
    <div className="pointer-events-none fixed inset-x-3 top-24 z-[2900] flex justify-center sm:inset-x-6 sm:justify-end">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[1.6rem] border border-sky-200/80 bg-white/96 px-4 py-3 text-sm text-slate-700 shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h5M20 20v-5h-5M5.6 15.5A7 7 0 0 0 18 14M18.4 8.5A7 7 0 0 0 6 10"
            />
          </svg>
        </span>
        <p className="min-w-0 flex-1 font-medium text-slate-800">{labels.title}</p>
        <button
          type="button"
          onClick={onReload}
          className="app-button-primary inline-flex min-h-11 shrink-0 items-center justify-center px-4 text-xs font-semibold"
        >
          {labels.reload}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
          aria-label={labels.dismiss}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
