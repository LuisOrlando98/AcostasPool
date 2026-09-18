"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import {
  fetchDevViewAccount,
  requestDevViewSwitch,
  type DevViewState,
} from "@/components/layout/DeveloperViewSwitcher";

/**
 * Franja fina arriba del contenido mientras un desarrollador ve la aplicación
 * como otro usuario. Recuerda que las acciones se atribuyen al usuario objetivo
 * y ofrece la salida rápida a la vista de administrador.
 *
 * Consulta `/api/auth/me` por su cuenta (sin caché) en lugar de recibir la vista
 * por props: así `AppShell` solo añade una línea y el aviso nunca queda obsoleto
 * tras un cambio de vista.
 */
export default function DeveloperViewBanner() {
  const { t } = useI18n();
  const router = useRouter();
  const [devView, setDevView] = useState<DevViewState | null>(null);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDevViewAccount().then((account) => {
      if (!cancelled) {
        setDevView(account.devView);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!devView) {
    return null;
  }

  const handleBack = async () => {
    setError(null);
    setReturning(true);
    try {
      const redirectTo = await requestDevViewSwitch("ADMIN");
      setDevView(null);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError(t("devView.errors.switch"));
      setReturning(false);
    }
  };

  return (
    <div
      role="status"
      data-testid="dev-view-banner"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)]"
    >
      <span className="truncate">
        {t("devView.banner.text", {
          role: t(`devView.roles.${devView.role}`),
          target: devView.targetLabel,
        })}
      </span>
      <span className="flex items-center gap-2">
        {error ? (
          <span role="alert" className="font-medium text-rose-600">
            {error}
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleBack}
          disabled={returning}
          data-testid="dev-view-back"
          className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--ink)] disabled:opacity-60"
        >
          {returning ? t("devView.banner.returning") : t("devView.banner.back")}
        </button>
      </span>
    </div>
  );
}
