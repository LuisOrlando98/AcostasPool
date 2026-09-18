"use client";

import { useEffect, useSyncExternalStore } from "react";
import { LOCALE_COOKIE, defaultLocale, normalizeLocale } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import { getShellTranslator } from "@/i18n/shell-messages";
import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const LOCALE_COOKIE_PATTERN = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`);

/**
 * global-error sustituye al layout raíz (incluido I18nProvider), así que el
 * locale se lee de la cookie ap_locale en el navegador; en servidor se usa el
 * locale por defecto y useSyncExternalStore evita desajustes de hidratación.
 * Los textos vienen del subconjunto síncrono de `@/i18n/shell-messages` (6
 * cadenas por idioma) para no meter ningún diccionario en el bundle cliente.
 */
function readLocaleFromCookie(): Locale {
  const match = document.cookie.match(LOCALE_COOKIE_PATTERN);
  return normalizeLocale(match?.[1] ?? null);
}

const subscribeToNothing = () => () => {};
const getServerLocale = (): Locale => defaultLocale;

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const locale = useSyncExternalStore(
    subscribeToNothing,
    readLocaleFromCookie,
    getServerLocale
  );
  const t = getShellTranslator(locale);

  useEffect(() => {
    // Fallo del layout raíz: se registra para diagnóstico (no es un log de depuración).
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang={locale}>
      {/* Sin next/font aquí (el layout raíz no se renderiza): fuente del sistema explícita. */}
      <body
        className="antialiased"
        style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
      >
        <main
          id="main-content"
          className="mx-auto min-h-screen w-full max-w-xl px-6 py-20 text-center"
        >
          <div className="app-card p-8" role="alert">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
              {t("globalShell.globalError.kicker")}
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">
              {t("globalShell.globalError.title")}
            </h1>
            <p className="mt-4 text-sm text-slate-600">
              {t("globalShell.globalError.subtitle")}
            </p>
            {error.digest ? (
              <p className="mt-2 font-mono text-xs text-slate-500">
                {t("globalShell.globalError.digest", { digest: error.digest })}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="app-button-primary inline-flex h-11 w-full items-center justify-center px-5 text-sm font-semibold sm:w-auto"
              >
                {t("globalShell.globalError.retry")}
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- el árbol del router ha fallado: la navegación completa es la recuperación fiable. */}
              <a
                href="/"
                className="app-button-secondary inline-flex h-11 w-full items-center justify-center px-5 text-sm font-semibold sm:w-auto"
              >
                {t("globalShell.globalError.backHome")}
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
