"use client";

/**
 * "Sin asignar / excluidos": las paradas que la estrategia no asignó y las que
 * el administrador ha quitado. Se quedan como están en la base de datos hasta
 * que se restauran.
 *
 * Es también zona donde soltar: arrastrar el asa de una parada hasta aquí la
 * excluye, y el asa de una parada excluida la devuelve a la ruta sobre la que
 * se suelte.
 */

import { useI18n } from "@/i18n/client";
import type { AssistantStop } from "@/lib/routing/assistant-types";
import { DragHandleIcon, RestoreIcon } from "./icons";
import { EXCLUDED_ZONE_ID, type StopDragHandleProps } from "./use-stop-drag";

type ExcludedPanelProps = {
  readonly stops: readonly AssistantStop[];
  readonly disabled: boolean;
  /** El puntero arrastra una parada sobre esta zona. */
  readonly active: boolean;
  readonly draggingJobId: string | null;
  readonly handleProps: (jobId: string) => StopDragHandleProps;
  readonly onRestore: (jobId: string) => void;
};

const PANEL_CLASS = "rounded-2xl border border-slate-200 bg-white p-3 sm:p-4";
const ACTIVE_PANEL_CLASS = "border-sky-400 ring-2 ring-sky-400";
const HANDLE_CLASS =
  "app-button-ghost inline-flex h-11 w-11 shrink-0 cursor-grab select-none items-center justify-center p-0 text-slate-500 active:cursor-grabbing";
/** Ver `StopRow`: `globals.css` pisa `touch-none`, así que el valor va en línea. */
const HANDLE_STYLE = { touchAction: "none" } as const;

export default function ExcludedPanel({
  stops,
  disabled,
  active,
  draggingJobId,
  handleProps,
  onRestore,
}: ExcludedPanelProps) {
  const { t } = useI18n();

  return (
    <section
      data-drop-zone={EXCLUDED_ZONE_ID}
      data-testid="assistant-excluded-zone"
      className={`${PANEL_CLASS} ${active ? ACTIVE_PANEL_CLASS : ""}`}
    >
      <h3 className="text-sm font-semibold text-slate-900">
        {t("admin.routes.assistant.excluded.title", { count: stops.length })}
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        {active
          ? t("admin.routes.assistant.drag.dropHere")
          : t("admin.routes.assistant.excluded.hint")}
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
              className={`flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
                draggingJobId === stop.jobId ? "opacity-40" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  {...handleProps(stop.jobId)}
                  disabled={disabled}
                  data-testid="assistant-stop-handle"
                  data-job-id={stop.jobId}
                  aria-label={t("admin.routes.assistant.a11y.dragExcluded", {
                    name: stop.customerName,
                  })}
                  className={HANDLE_CLASS}
                  style={HANDLE_STYLE}
                >
                  <DragHandleIcon />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {stop.customerName}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-slate-500">
                    {stop.address}
                  </p>
                </div>
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
