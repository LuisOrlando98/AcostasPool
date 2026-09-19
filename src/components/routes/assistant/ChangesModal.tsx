"use client";

/**
 * Resumen de cambios antes de aplicar. Tabla con `<caption>` y `scope="col"`
 * (varias tablas idénticas sin nombre era uno de los fallos de 1.3.1) y una
 * fila por cambio: "3 → 1" al reordenar, "Ana → Luis" al reasignar.
 */

import { useId, useRef } from "react";
import { useI18n } from "@/i18n/client";
import AppModal from "@/components/ui/AppModal";
import type {
  AssistantStop,
  AssistantTechnician,
} from "@/lib/routing/assistant-types";
import type { DraftChange, DraftDiff } from "@/lib/routing/draft";

type ChangesModalProps = {
  readonly open: boolean;
  readonly diff: DraftDiff;
  readonly stops: readonly AssistantStop[];
  readonly technicians: readonly AssistantTechnician[];
  readonly onClose: () => void;
};

const CARD_CLASS =
  "max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl";
const CELL_CLASS = "px-3 py-2 text-left align-top";
const HEADER_CLASS = `${CELL_CLASS} text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500`;

export default function ChangesModal({
  open,
  diff,
  stops,
  technicians,
  onClose,
}: ChangesModalProps) {
  const { t } = useI18n();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const closeRef = useRef<HTMLButtonElement>(null);
  const nameByJobId = new Map(stops.map((stop) => [stop.jobId, stop.customerName]));
  const nameByTechnicianId = new Map(
    technicians.map((technician) => [technician.id, technician.name])
  );
  const unassignedLabel = t("admin.routes.assistant.changes.unassigned");

  const describe = (change: DraftChange): { from: string; to: string } => {
    if (change.kind === "order") {
      return { from: String(change.from), to: String(change.to) };
    }
    if (change.kind === "technician") {
      return {
        from: change.from ? (nameByTechnicianId.get(change.from) ?? change.from) : unassignedLabel,
        to: nameByTechnicianId.get(change.to) ?? change.to,
      };
    }
    return {
      from: t("admin.routes.assistant.changes.inProposal"),
      to: t("admin.routes.assistant.changes.kind.removed"),
    };
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      titleId={titleId}
      cardClassName={CARD_CLASS}
      layerClassName="overflow-y-auto p-3 sm:p-6"
      initialFocusRef={closeRef}
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {t("admin.routes.assistant.changes.title")}
        </h2>

        <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs text-slate-700">
            <caption className="px-3 py-2 text-left text-xs text-slate-500">
              {t("admin.routes.assistant.changes.summary", {
                total: diff.total,
                reordered: diff.reordered,
                reassigned: diff.reassigned,
                removed: diff.removed,
              })}
            </caption>
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className={HEADER_CLASS}>
                  {t("admin.routes.assistant.table.customer")}
                </th>
                <th scope="col" className={HEADER_CLASS}>
                  {t("admin.routes.assistant.changes.columns.kind")}
                </th>
                <th scope="col" className={HEADER_CLASS}>
                  {t("admin.routes.assistant.changes.columns.from")}
                </th>
                <th scope="col" className={HEADER_CLASS}>
                  {t("admin.routes.assistant.changes.columns.to")}
                </th>
              </tr>
            </thead>
            <tbody>
              {diff.changes.length === 0 ? (
                <tr>
                  <td className={CELL_CLASS} colSpan={4}>
                    {t("admin.routes.assistant.changes.none")}
                  </td>
                </tr>
              ) : (
                diff.changes.map((change) => {
                  const values = describe(change);
                  return (
                    <tr key={`${change.kind}-${change.jobId}`} className="border-t border-slate-100">
                      <td className={CELL_CLASS}>
                        {nameByJobId.get(change.jobId) ?? change.jobId}
                      </td>
                      <td className={CELL_CLASS}>
                        {t(`admin.routes.assistant.changes.kind.${change.kind}`)}
                      </td>
                      <td className={CELL_CLASS}>{values.from}</td>
                      <td className={`${CELL_CLASS} font-semibold text-slate-900`}>
                        {values.to}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="app-button-secondary min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            {t("common.actions.close")}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
