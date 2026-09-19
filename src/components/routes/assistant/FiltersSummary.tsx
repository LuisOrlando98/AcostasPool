"use client";

/**
 * El paso 1, recogido en una línea tras generar, para que la propuesta empiece
 * por encima del pliegue. [Editar] vuelve a desplegar el formulario.
 */

import { useI18n } from "@/i18n/client";
import type { AssistantTechnician } from "@/lib/routing/assistant-types";
import type { AssistantFilterValues, AssistantPlanOption } from "./types";

type FiltersSummaryProps = {
  readonly values: AssistantFilterValues;
  readonly planOptions: readonly AssistantPlanOption[];
  readonly technicians: readonly AssistantTechnician[];
  readonly onEdit: () => void;
};

export default function FiltersSummary({
  values,
  planOptions,
  technicians,
  onEdit,
}: FiltersSummaryProps) {
  const { t } = useI18n();
  const planLabel =
    planOptions.find((option) => option.value === values.planTemplate)?.label ??
    t("admin.routes.assistant.filters.allPlans");
  const selectedNames = technicians
    .filter((technician) => values.technicianIds.includes(technician.id))
    .map((technician) => technician.name);
  const technicianLabel =
    selectedNames.length === 0
      ? t("admin.routes.assistant.filters.allTechnicians")
      : selectedNames.join(" · ");

  return (
    <div className="app-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">{values.date}</span>
        <span aria-hidden="true"> · </span>
        <span>{planLabel}</span>
        <span aria-hidden="true"> · </span>
        <span>{technicianLabel}</span>
        {values.addressQuery.trim() ? (
          <>
            <span aria-hidden="true"> · </span>
            <span>
              {t("admin.routes.assistant.filters.querySummary", {
                query: values.addressQuery.trim(),
              })}
            </span>
          </>
        ) : null}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="app-button-secondary min-h-11 shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
      >
        {t("common.actions.edit")}
      </button>
    </div>
  );
}
