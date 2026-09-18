"use client";

import { useI18n } from "@/i18n/client";

const SKELETON_ROW_WIDTHS = ["w-1/4", "w-2/3", "w-full", "w-5/6"] as const;

/**
 * Esqueleto mínimo del segmento raíz. Es un componente cliente (síncrono) para
 * que el fallback de Suspense nunca suspenda; el texto se anuncia vía role=status.
 */
export default function RootLoading() {
  const { t } = useI18n();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-3xl px-6 py-16"
    >
      <span className="sr-only">{t("globalShell.loading.label")}</span>
      <div aria-hidden="true" className="app-card animate-pulse space-y-4 p-6">
        {SKELETON_ROW_WIDTHS.map((width) => (
          <div key={width} className={`h-3 rounded-full bg-slate-200 ${width}`} />
        ))}
      </div>
    </div>
  );
}
