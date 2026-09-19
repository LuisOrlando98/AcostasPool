"use client";

/**
 * Una parada de la propuesta como tarjeta (nunca fila de tabla: en 390 px la
 * tabla de 7 columnas era inservible). Los cuatro botones son objetivos de
 * 44×44 y su nombre accesible incluye la posición y el cliente, porque el
 * icono por sí solo no distingue una parada de otra.
 */

import { useI18n } from "@/i18n/client";
import type { AssistantStop } from "@/lib/routing/assistant-types";
import { formatDrive } from "./format";
import { driveSourceKey, driveSourceTone, jobStatusKey, jobStatusTone } from "./labels";
import { ArrowDownIcon, ArrowUpIcon, MoveIcon, RemoveIcon } from "./icons";

type StopRowProps = {
  readonly stop: AssistantStop;
  readonly position: number;
  readonly total: number;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onMove: () => void;
  readonly onRemove: () => void;
};

const ICON_BUTTON_CLASS =
  "app-button-ghost inline-flex h-11 w-11 items-center justify-center p-0 text-slate-600";
const TEXT_BUTTON_CLASS =
  "app-button-ghost inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700";
const CHIP_CLASS = "app-chip px-2.5 py-1 text-[11px]";

export default function StopRow({
  stop,
  position,
  total,
  pending,
  disabled,
  onMoveUp,
  onMoveDown,
  onMove,
  onRemove,
}: StopRowProps) {
  const { t } = useI18n();
  const sourceKey = driveSourceKey(stop.driveSource);
  const labelValues = { name: stop.customerName, position };
  // La hora principal es el inicio del servicio; la llegada real solo se
  // muestra aparte cuando se llega antes de la hora citada y hay espera.
  const waitsBeforeService =
    stop.estimatedArrivalTime !== "" &&
    stop.estimatedArrivalTime !== stop.serviceStartTime;

  return (
    <li
      data-testid="assistant-stop"
      data-job-id={stop.jobId}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex min-w-0 gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white"
        >
          {position}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {stop.customerName}
            <span className="sr-only">
              {` — ${t("admin.routes.assistant.stop.position", { position, total })}`}
            </span>
          </p>
          <p className="mt-0.5 break-words text-xs text-slate-500">{stop.address}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={CHIP_CLASS} data-tone="neutral">
              {t("admin.routes.assistant.stop.serviceStart", {
                value: pending ? "--:--" : stop.serviceStartTime,
              })}
            </span>
            {!pending && waitsBeforeService ? (
              <span className={CHIP_CLASS} data-tone="neutral">
                {t("admin.routes.assistant.stop.arrival", {
                  value: stop.estimatedArrivalTime,
                })}
              </span>
            ) : null}
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
                {t("admin.routes.assistant.stop.noCoordinates")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={disabled || position <= 1}
          aria-label={t("admin.routes.assistant.a11y.moveUp", labelValues)}
          className={ICON_BUTTON_CLASS}
        >
          <ArrowUpIcon />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={disabled || position >= total}
          aria-label={t("admin.routes.assistant.a11y.moveDown", labelValues)}
          className={ICON_BUTTON_CLASS}
        >
          <ArrowDownIcon />
        </button>
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
