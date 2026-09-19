"use client";

/**
 * Paso 1: alcance de la propuesta. Formulario real (Enter envía), etiquetas
 * con `for`/`id`, plan opcional ("Todos los planes") y técnicos opcionales y
 * múltiples. El salto de fecha al elegir plan se avisa antes de que ocurra
 * (`aria-describedby` del selector de plan).
 */

import { useId } from "react";
import { useI18n } from "@/i18n/client";
import type { AssistantTechnician } from "@/lib/routing/assistant-types";
import { getGlobalRecurringPlan } from "@/lib/jobs/recurring-plan-templates";
import { alignDateToPlanWeekday } from "./format";
import type { AssistantFilterValues, AssistantPlanOption } from "./types";

type AssistantFiltersProps = {
  readonly values: AssistantFilterValues;
  readonly planOptions: readonly AssistantPlanOption[];
  readonly technicians: readonly AssistantTechnician[];
  readonly originAddress: string;
  readonly loading: boolean;
  readonly onChange: (values: AssistantFilterValues) => void;
  readonly onSubmit: () => void;
};

const FIELD_LABEL_CLASS =
  "block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500";
const FIELD_CLASS = "app-input mt-2 w-full px-3 py-2.5 text-sm";
const CHECKBOX_CLASS =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700";

export default function AssistantFilters({
  values,
  planOptions,
  technicians,
  originAddress,
  loading,
  onChange,
  onSubmit,
}: AssistantFiltersProps) {
  const { t } = useI18n();
  const baseId = useId();
  const dateId = `${baseId}-date`;
  const planId = `${baseId}-plan`;
  const planHintId = `${baseId}-plan-hint`;
  const queryId = `${baseId}-query`;
  const techniciansLabelId = `${baseId}-technicians`;
  const allTechniciansId = `${baseId}-technicians-all`;

  const handlePlanChange = (planTemplate: string) => {
    const weekday = planTemplate
      ? (getGlobalRecurringPlan(planTemplate)?.weekday ?? null)
      : null;
    onChange({
      ...values,
      planTemplate,
      date: alignDateToPlanWeekday(values.date, weekday),
    });
  };

  const toggleTechnician = (technicianId: string, checked: boolean) => {
    const technicianIds = checked
      ? [...values.technicianIds, technicianId]
      : values.technicianIds.filter((id) => id !== technicianId);
    onChange({ ...values, technicianIds });
  };

  return (
    <form
      className="app-card p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="text-base font-semibold text-slate-900">
        {t("admin.routes.assistant.steps.filters")}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {t("admin.routes.assistant.steps.filtersHint")}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor={dateId}>
            {t("admin.routes.assistant.fields.date")}
          </label>
          <input
            id={dateId}
            name="date"
            type="date"
            required
            value={values.date}
            onChange={(event) => onChange({ ...values, date: event.target.value })}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor={planId}>
            {t("admin.routes.assistant.fields.plan")}
          </label>
          <select
            id={planId}
            name="planTemplate"
            value={values.planTemplate}
            aria-describedby={planHintId}
            onChange={(event) => handlePlanChange(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">{t("admin.routes.assistant.filters.allPlans")}</option>
            {planOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p id={planHintId} className="mt-1.5 text-xs text-slate-500">
            {t("admin.routes.assistant.filters.planDateHint")}
          </p>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend id={techniciansLabelId} className={FIELD_LABEL_CLASS}>
          {t("admin.routes.assistant.fields.technicians")}
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className={CHECKBOX_CLASS} htmlFor={allTechniciansId}>
            <input
              id={allTechniciansId}
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300"
              checked={values.technicianIds.length === 0}
              onChange={() => onChange({ ...values, technicianIds: [] })}
            />
            <span>{t("admin.routes.assistant.filters.allTechnicians")}</span>
          </label>
          {technicians.map((technician) => {
            const checkboxId = `${baseId}-tech-${technician.id}`;
            return (
              <label key={technician.id} className={CHECKBOX_CLASS} htmlFor={checkboxId}>
                <input
                  id={checkboxId}
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300"
                  checked={values.technicianIds.includes(technician.id)}
                  onChange={(event) =>
                    toggleTechnician(technician.id, event.target.checked)
                  }
                />
                <span>{technician.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <label className={FIELD_LABEL_CLASS} htmlFor={queryId}>
          {t("admin.routes.assistant.fields.addressFilter")}
        </label>
        <input
          id={queryId}
          name="addressQuery"
          type="search"
          maxLength={120}
          value={values.addressQuery}
          placeholder={t("admin.routes.assistant.placeholders.addressFilter")}
          onChange={(event) => onChange({ ...values, addressQuery: event.target.value })}
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t("admin.routes.assistant.fields.origin")}
          </p>
          <p className="mt-1 truncate font-medium text-slate-800">{originAddress}</p>
        </div>
        <button
          type="submit"
          disabled={loading || !values.date}
          className="app-button-primary min-h-11 w-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] sm:w-auto"
        >
          {loading
            ? t("admin.routes.assistant.actions.generating")
            : t("admin.routes.assistant.actions.generate")}
        </button>
      </div>

      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
          {t("admin.routes.assistant.rules.title")}
        </summary>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>{t("admin.routes.assistant.rules.bookingWindows")}</li>
          <li>{t("admin.routes.assistant.rules.weekendPolicy")}</li>
          <li>{t("admin.routes.assistant.rules.noReschedule")}</li>
        </ul>
      </details>
    </form>
  );
}
