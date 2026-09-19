"use client";

/**
 * "Sin asignar / excluidos": las paradas que la estrategia no asignó y las que
 * el administrador ha quitado. Se quedan como están en la base de datos hasta
 * que se restauran.
 */

import { useI18n } from "@/i18n/client";
import type { AssistantStop } from "@/lib/routing/assistant-types";
import { RestoreIcon } from "./icons";

type ExcludedPanelProps = {
  readonly stops: readonly AssistantStop[];
  readonly disabled: boolean;
  readonly onRestore: (jobId: string) => void;
};

export default function ExcludedPanel({
  stops,
  disabled,
  onRestore,
}: ExcludedPanelProps) {
  const { t } = useI18n();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-slate-900">
        {t("admin.routes.assistant.excluded.title", { count: stops.length })}
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        {t("admin.routes.assistant.excluded.hint")}
      </p>
      {stops.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          {t("admin.routes.assistant.excluded.empty")}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {stops.map((stop) => (
            <li
              key={stop.jobId}
              data-testid="assistant-excluded-stop"
              data-job-id={stop.jobId}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {stop.customerName}
                </p>
                <p className="mt-0.5 break-words text-xs text-slate-500">
                  {stop.address}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(stop.jobId)}
                disabled={disabled}
                aria-label={t("admin.routes.assistant.a11y.restore", {
                  name: stop.customerName,
                })}
                className="app-button-ghost inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <RestoreIcon />
                <span>{t("admin.routes.assistant.actions.restore")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
