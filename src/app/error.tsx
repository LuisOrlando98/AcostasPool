"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Límite de error de la ruta raíz: se renderiza dentro del layout raíz (con
 * I18nProvider disponible) cuando una página o layout anidado lanza en runtime.
 */
export default function RouteError({ error, reset }: RouteErrorProps) {
  const { t } = useI18n();

  useEffect(() => {
    // Error de runtime no controlado: se registra para diagnóstico (no es un log de depuración).
    console.error("[app/error]", error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto min-h-screen w-full max-w-xl px-6 py-20 text-center"
    >
      <div className="app-card p-8" role="alert">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
          {t("globalShell.error.kicker")}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          {t("globalShell.error.title")}
        </h1>
        <p className="mt-4 text-sm text-slate-600">
          {t("globalShell.error.subtitle")}
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-slate-500">
            {t("globalShell.error.digest", { digest: error.digest })}
          </p>
        ) : null}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={reset}
            className="app-button-primary inline-flex h-11 items-center px-5 text-sm font-semibold"
          >
            {t("globalShell.error.retry")}
          </button>
        </div>
      </div>
    </main>
  );
}
