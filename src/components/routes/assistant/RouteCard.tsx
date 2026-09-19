"use client";

/**
 * Ruta propuesta de un técnico: encabezado de nivel 3 (la sección de
 * resultados tiene su propio h2) con la carga de la ruta y la lista de
 * paradas. `aria-busy` mientras se recalculan los tiempos.
 *
 * La tarjeta entera es zona donde soltar (`data-drop-zone` con el id del
 * técnico): el asa de una parada de otra ruta puede soltarse aquí y la barra
 * azul marca en qué posición caería.
 */

import { useI18n } from "@/i18n/client";
import type { AssistantRoute } from "@/lib/routing/assistant-types";
import type { RouteLike } from "./draft-view";
import { summarizeRoute } from "./draft-view";
import { formatMinutes } from "./format";
import StopRow, { type DropIndicator } from "./StopRow";
import type { StopDragHandleProps } from "./use-stop-drag";

type RouteCardProps = {
  readonly route: RouteLike;
  /** Datos de ruta del último plan del servidor (regreso, salto de día). */
  readonly meta: AssistantRoute | null;
  readonly pending: boolean;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly draggingJobId: string | null;
  /** Posición de inserción si el puntero está sobre esta ruta; si no, `null`. */
  readonly dropIndex: number | null;
  readonly handleProps: (jobId: string) => StopDragHandleProps;
  readonly onKeyboardMove: (jobId: string, delta: -1 | 1) => void;
  readonly onMove: (jobId: string) => void;
  readonly onRemove: (jobId: string) => void;
  readonly onFixLocation: (jobId: string) => void;
};

const CARD_CLASS = "rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4";
const ACTIVE_CARD_CLASS = "ring-2 ring-sky-400";
const EMPTY_CLASS =
  "mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500";
const ACTIVE_EMPTY_CLASS = "border-sky-400 bg-sky-50 text-sky-700";

export default function RouteCard({
  route,
  meta,
  pending,
  busy,
  disabled,
  draggingJobId,
  dropIndex,
  handleProps,
  onKeyboardMove,
  onMove,
  onRemove,
  onFixLocation,
}: RouteCardProps) {
  const { t } = useI18n();
  const load = summarizeRoute(route);
  // Tras editar, el regreso del plan ya no corresponde al orden en pantalla.
  const returnTime =
    pending || route.stops.length === 0
      ? null
      : (meta?.estimatedReturnTime ?? null);
  const active = dropIndex !== null;

  /** La barra azul va sobre la fila de destino, o bajo la última si se suelta al final. */
  const indicatorFor = (index: number): DropIndicator => {
    if (dropIndex === null) {
      return null;
    }
    if (dropIndex === index) {
      return "before";
    }
    return index === route.stops.length - 1 && dropIndex > index ? "after" : null;
  };

  return (
    <section
      aria-busy={busy || undefined}
      data-drop-zone={route.technicianId}
      className={`${CARD_CLASS} ${active ? ACTIVE_CARD_CLASS : ""}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {route.technicianName}
        </h3>
        <p className="text-xs text-slate-600">
          {t.plural("admin.routes.assistant.summary.stops", load.stops)}
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
        <p className={`${EMPTY_CLASS} ${active ? ACTIVE_EMPTY_CLASS : ""}`}>
          {active
            ? t("admin.routes.assistant.drag.dropHere")
            : t("admin.routes.assistant.route.empty")}
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
              dragging={draggingJobId === stop.jobId}
              indicator={indicatorFor(index)}
              handleProps={handleProps(stop.jobId)}
              onKeyboardMove={(delta) => onKeyboardMove(stop.jobId, delta)}
              onMove={() => onMove(stop.jobId)}
              onRemove={() => onRemove(stop.jobId)}
              onFixLocation={() => onFixLocation(stop.jobId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
