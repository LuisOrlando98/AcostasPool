"use client";

/**
 * Mover una parada a otro técnico (o excluirla) eligiendo entre radios que
 * muestran la carga actual de cada ruta. Si no hay otro técnico en la
 * propuesta el modal lo dice en lugar de ofrecer una lista vacía.
 */

import { useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import AppModal from "@/components/ui/AppModal";
import type { AssistantStop } from "@/lib/routing/assistant-types";
import type { RouteLike } from "./draft-view";
import { summarizeRoute } from "./draft-view";
import { formatMinutes } from "./format";

type MoveStopModalProps = {
  readonly open: boolean;
  readonly stop: AssistantStop | null;
  readonly currentTechnicianId: string | null;
  readonly routes: readonly RouteLike[];
  readonly onClose: () => void;
  readonly onConfirm: (technicianId: string | null) => void;
};

/** Valor del radio que excluye la parada de la propuesta. */
const EXCLUDE_VALUE = "__excluded__";

const CARD_CLASS =
  "max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl";
const OPTION_CLASS =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700";

export default function MoveStopModal({
  open,
  stop,
  currentTechnicianId,
  routes,
  onClose,
  onConfirm,
}: MoveStopModalProps) {
  const { t } = useI18n();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const closeRef = useRef<HTMLButtonElement>(null);
  const targets = routes.filter((route) => route.technicianId !== currentTechnicianId);
  /**
   * La selección se guarda junto al trabajo al que pertenece: al abrir el
   * modal con otra parada vuelve sola al primer técnico disponible, sin
   * efectos ni sincronización manual.
   */
  const [choice, setChoice] = useState<{ jobId: string; value: string } | null>(null);
  const defaultValue = targets[0]?.technicianId ?? EXCLUDE_VALUE;
  const selected =
    choice && choice.jobId === stop?.jobId ? choice.value : defaultValue;
  const select = (value: string) => {
    if (stop) {
      setChoice({ jobId: stop.jobId, value });
    }
  };

  return (
    <AppModal
      open={open && stop !== null}
      onClose={onClose}
      titleId={titleId}
      cardClassName={CARD_CLASS}
      layerClassName="overflow-y-auto p-3 sm:p-6"
      initialFocusRef={closeRef}
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {t("admin.routes.assistant.move.title")}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-slate-500">
          {t("admin.routes.assistant.move.description", {
            name: stop?.customerName ?? "",
          })}
        </p>

        {targets.length === 0 ? (
          <p
            className="app-callout mt-4 px-4 py-3 text-sm"
            data-tone="info"
            role="status"
          >
            {t("admin.routes.assistant.move.onlyOne")}
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-labelledby={descriptionId}
            className="mt-4 space-y-2"
          >
            {targets.map((route) => {
              const load = summarizeRoute(route);
              const optionId = `${baseId}-${route.technicianId}`;
              return (
                <label key={route.technicianId} htmlFor={optionId} className={OPTION_CLASS}>
                  <input
                    id={optionId}
                    type="radio"
                    name={`${baseId}-target`}
                    className="h-5 w-5"
                    value={route.technicianId}
                    checked={selected === route.technicianId}
                    onChange={() => select(route.technicianId)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900">
                      {route.technicianName}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {t.plural("admin.routes.assistant.move.load", load.stops, {
                        drive: formatMinutes(load.driveMinutes),
                      })}
                    </span>
                  </span>
                </label>
              );
            })}
            <label htmlFor={`${baseId}-exclude`} className={OPTION_CLASS}>
              <input
                id={`${baseId}-exclude`}
                type="radio"
                name={`${baseId}-target`}
                className="h-5 w-5"
                value={EXCLUDE_VALUE}
                checked={selected === EXCLUDE_VALUE}
                onChange={() => select(EXCLUDE_VALUE)}
              />
              <span className="font-medium text-slate-900">
                {t("admin.routes.assistant.move.exclude")}
              </span>
            </label>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="app-button-secondary min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            {t("common.actions.cancel")}
          </button>
          <button
            type="button"
            disabled={targets.length === 0}
            onClick={() =>
              onConfirm(selected === EXCLUDE_VALUE ? null : selected)
            }
            className="app-button-primary min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            {t("admin.routes.assistant.actions.move")}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
