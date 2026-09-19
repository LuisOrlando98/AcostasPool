"use client";

/**
 * Ruta propuesta de un técnico: encabezado de nivel 3 (la sección de
 * resultados tiene su propio h2) con la carga de la ruta y la lista de
 * paradas. `aria-busy` mientras se recalculan los tiempos.
 */

import { useI18n } from "@/i18n/client";
import type { AssistantRoute } from "@/lib/routing/assistant-types";
import type { RouteLike } from "./draft-view";
import { summarizeRoute } from "./draft-view";
import { formatMinutes } from "./format";
import StopRow from "./StopRow";

type RouteCardProps = {
  readonly route: RouteLike;
  /** Datos de ruta del último plan del servidor (regreso, salto de día). */
  readonly meta: AssistantRoute | null;
  readonly pending: boolean;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onMoveUp: (jobId: string) => void;
  readonly onMoveDown: (jobId: string) => void;
  readonly onMove: (jobId: string) => void;
  readonly onRemove: (jobId: string) => void;
};

export default function RouteCard({
  route,
  meta,
  pending,
  busy,
  disabled,
  onMoveUp,
  onMoveDown,
  onMove,
  onRemove,
}: RouteCardProps) {
  const { t } = useI18n();
  const load = summarizeRoute(route);
  // Tras editar, el regreso del plan ya no corresponde al orden en pantalla.
  const returnTime =
    pending || route.stops.length === 0
      ? null
      : (meta?.estimatedReturnTime ?? null);

  return (
    <section
      aria-busy={busy || undefined}
      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {route.technicianName}
        </h3>
        <p className="text-xs text-slate-600">
          {t("admin.routes.assistant.summary.stops", { count: load.stops })}
          <span aria-hidden="true"> · </span>
          {t("admin.routes.assistant.summary.drive", {
            value: formatMinutes(load.driveMinutes),
          })}
          <span aria-hidden="true"> · </span>
          {t("admin.routes.assistant.summary.service", {
            value: formatMinutes(load.serviceMinutes),
          })}
        </p>
      </div>

      {returnTime ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>
            {t("admin.routes.assistant.route.return", { value: returnTime })}
          </span>
          {meta?.overflowsDay ? (
            <span className="app-chip px-2.5 py-1 text-[11px]" data-tone="warning">
              {t("admin.routes.assistant.route.overflowsDay")}
            </span>
          ) : null}
        </p>
      ) : null}

      {route.stops.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
          {t("admin.routes.assistant.route.empty")}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {route.stops.map((stop, index) => (
            <StopRow
              key={stop.jobId}
              stop={stop}
              position={index + 1}
              total={route.stops.length}
              pending={pending}
              disabled={disabled}
              onMoveUp={() => onMoveUp(stop.jobId)}
              onMoveDown={() => onMoveDown(stop.jobId)}
              onMove={() => onMove(stop.jobId)}
              onRemove={() => onRemove(stop.jobId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
