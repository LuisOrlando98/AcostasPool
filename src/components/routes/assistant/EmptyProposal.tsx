"use client";

/**
 * Estado vacío neutro (no verde de éxito, como antes) y con la causa al lado
 * del dato: cuántos trabajos del día quedaron fuera y por qué filtro.
 */

import { useI18n } from "@/i18n/client";
import type { AssistantTechnician } from "@/lib/routing/assistant-types";
import { WarningIcon } from "./icons";
import type { AssistantFilterValues, AssistantPlanOption } from "./types";

type EmptyProposalProps = {
  readonly excludedCount: number;
  readonly values: AssistantFilterValues;
  readonly planOptions: readonly AssistantPlanOption[];
  readonly technicians: readonly AssistantTechnician[];
  readonly onEditFilters: () => void;
};

export default function EmptyProposal({
  excludedCount,
  values,
  planOptions,
  technicians,
  onEditFilters,
}: EmptyProposalProps) {
  const { t } = useI18n();
  const planLabel =
    planOptions.find((option) => option.value === values.planTemplate)?.label ??
    t("admin.routes.assistant.filters.allPlans");
  const technicianLabel =
    values.technicianIds.length === 0
      ? t("admin.routes.assistant.filters.allTechnicians")
      : technicians
          .filter((technician) => values.technicianIds.includes(technician.id))
          .map((technician) => technician.name)
          .join(" · ");

  return (
    <div className="app-callout flex flex-col gap-3 p-5 sm:flex-row sm:items-start" data-tone="info">
      <WarningIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {t("admin.routes.assistant.empty.title")}
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>{t("admin.routes.assistant.empty.excluded", { count: excludedCount })}</li>
          <li>{t("admin.routes.assistant.empty.plan", { plan: planLabel })}</li>
          <li>
            {t("admin.routes.assistant.empty.technicians", {
              technicians: technicianLabel,
            })}
          </li>
        </ul>
        <p className="mt-2 text-sm">{t("admin.routes.assistant.empty.hint")}</p>
        <button
          type="button"
          onClick={onEditFilters}
          className="app-button-secondary mt-3 min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
        >
          {t("common.actions.edit")}
        </button>
      </div>
    </div>
  );
}
