"use client";

/**
 * Una parada de la propuesta como tarjeta (nunca fila de tabla: en 390 px la
 * tabla de 7 columnas era inservible). El asa ⠿ arrastra la parada con el
 * puntero (ratón o dedo) y, con Alt + flecha arriba/abajo, la mueve sin
 * arrastrar; los botones son objetivos de 44×44 y su nombre accesible incluye
 * el cliente y la posición, porque el icono por sí solo no distingue una
 * parada de otra.
 *
 * La hora que se muestra es la llegada estimada: los servicios de piscina se
 * programan por día, no por hora, así que la hora citada y el retraso frente a
 * ella no significan nada para quien ordena la ruta.
 */

import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useI18n } from "@/i18n/client";
import type { AssistantStop } from "@/lib/routing/assistant-types";
import { formatDrive } from "./format";
import { driveSourceKey, driveSourceTone, jobStatusKey, jobStatusTone } from "./labels";
import { DragHandleIcon, LocationIcon, MoveIcon, RemoveIcon } from "./icons";
import type { StopDragHandleProps } from "./use-stop-drag";

/** Dónde se pintaría la parada arrastrada respecto a esta fila. */
export type DropIndicator = "before" | "after" | null;

type StopRowProps = {
  readonly stop: AssistantStop;
  readonly position: number;
  readonly total: number;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly dragging: boolean;
  readonly indicator: DropIndicator;
  readonly handleProps: StopDragHandleProps;
  readonly onKeyboardMove: (delta: -1 | 1) => void;
  readonly onMove: () => void;
  readonly onRemove: () => void;
  readonly onFixLocation: () => void;
};

const TEXT_BUTTON_CLASS =
  "app-button-ghost inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700";
const FIX_BUTTON_CLASS =
  "app-button-ghost inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-700";
const CHIP_CLASS = "app-chip px-2.5 py-1 text-[11px]";
const HANDLE_CLASS =
  "app-button-ghost inline-flex h-11 w-11 shrink-0 cursor-grab select-none items-center justify-center p-0 text-slate-500 active:cursor-grabbing";
/**
 * En línea a propósito: `globals.css` fija `touch-action: manipulation` a todo
 * `button` fuera de capa y eso gana a la utilidad `touch-none` de Tailwind. Sin
 * `none`, el dedo desplazaría la página en vez de arrastrar la parada.
 */
const HANDLE_STYLE = { touchAction: "none" } as const;
const INDICATOR_CLASS =
  "pointer-events-none absolute inset-x-2 h-1 rounded-full bg-sky-500";
const PENDING_TIME = "--:--";

/** Alt + estas teclas mueve la parada una posición sin usar el puntero. */
const KEYBOARD_MOVES = new Map<string, -1 | 1>([
  ["ArrowUp", -1],
  ["ArrowDown", 1],
]);

export default function StopRow({
  stop,
  position,
  total,
  pending,
  disabled,
  dragging,
  indicator,
  handleProps,
  onKeyboardMove,
  onMove,
  onRemove,
  onFixLocation,
}: StopRowProps) {
  const { t } = useI18n();
  const sourceKey = driveSourceKey(stop.driveSource);
  const labelValues = { name: stop.customerName, position, total };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const delta = KEYBOARD_MOVES.get(event.key);
    if (delta === undefined) {
      return;
    }
    event.preventDefault();
    onKeyboardMove(delta);
  };

  return (
    <li
      data-testid="assistant-stop"
      data-drag-row="true"
      data-job-id={stop.jobId}
      data-dragging={dragging ? "true" : undefined}
      className={`relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-start sm:justify-between ${
        dragging ? "opacity-40" : ""
      }`}
    >
      {indicator ? (
        <span
          aria-hidden="true"
          data-testid="assistant-drop-indicator"
          className={`${INDICATOR_CLASS} ${
            indicator === "before" ? "-top-1.5" : "-bottom-1.5"
          }`}
        />
      ) : null}

      <div className="flex min-w-0 gap-2">
        <button
          type="button"
          {...handleProps}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          data-testid="assistant-stop-handle"
          data-job-id={stop.jobId}
          aria-label={t("admin.routes.assistant.a11y.dragHandle", labelValues)}
          className={HANDLE_CLASS}
          style={HANDLE_STYLE}
        >
          <DragHandleIcon />
        </button>
        <span
          aria-hidden="true"
          className="mt-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white"
        >
          {position}
        </span>
        <div className="min-w-0 pt-1.5">
          <p className="text-sm font-semibold text-slate-900">
            {stop.customerName}
            <span className="sr-only">
              {` — ${t("admin.routes.assistant.stop.position", { position, total })}`}
            </span>
          </p>
          <p className="mt-0.5 break-words text-xs text-slate-500">{stop.address}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={CHIP_CLASS} data-tone="neutral">
              {t("admin.routes.assistant.stop.arrival", {
                value: pending ? PENDING_TIME : stop.estimatedArrivalTime,
              })}
            </span>
            <span className={CHIP_CLASS} data-tone={driveSourceTone(stop.driveSource)}>
              {formatDrive(
                stop.estimatedDriveMinutesFromPrevious,
                stop.distanceMilesFromPrevious
              )}
              {sourceKey ? ` · ${t(sourceKey)}` : ""}
            </span>
            <span className={CHIP_CLASS} data-tone={jobStatusTone(stop.status)}>
              {t(jobStatusKey(stop.status))}
            </span>
            {stop.planName ? (
              <span className={CHIP_CLASS} data-tone="neutral">
                {stop.planName}
              </span>
            ) : null}
            {stop.hasCoordinates ? null : (
              <span className={CHIP_CLASS} data-tone="warning">
                {t("admin.routes.assistant.stop.noLocation")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {stop.hasCoordinates ? null : (
          <button
            type="button"
            onClick={onFixLocation}
            disabled={disabled}
            data-testid="assistant-fix-location"
            data-job-id={stop.jobId}
            aria-label={t("admin.routes.assistant.a11y.fixLocation", {
              name: stop.customerName,
            })}
            className={FIX_BUTTON_CLASS}
          >
            <LocationIcon />
            <span>{t("admin.routes.assistant.actions.fixLocation")}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onMove}
          disabled={disabled}
          aria-label={t("admin.routes.assistant.a11y.move", labelValues)}
          className={TEXT_BUTTON_CLASS}
        >
          <MoveIcon />
          <span>{t("admin.routes.assistant.actions.move")}</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t("admin.routes.assistant.a11y.remove", labelValues)}
          className={TEXT_BUTTON_CLASS}
        >
          <RemoveIcon />
          <span>{t("admin.routes.assistant.actions.remove")}</span>
        </button>
      </div>
    </li>
  );
}
