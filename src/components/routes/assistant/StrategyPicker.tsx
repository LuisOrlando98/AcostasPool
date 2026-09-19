"use client";

/**
 * Selector de estrategia como grupo de radios nativo: el estado seleccionado
 * lo expone el propio control (no solo el color) y las flechas del teclado
 * recorren las opciones sin código extra.
 */

import { useId } from "react";
import { useI18n } from "@/i18n/client";
import type { AssistantPlan, AssistantStrategy } from "@/lib/routing/assistant-types";
import { formatMinutes } from "./format";

type StrategyPickerProps = {
  readonly plans: readonly AssistantPlan[];
  readonly selected: AssistantStrategy | null;
  readonly onSelect: (strategy: AssistantStrategy) => void;
};

export default function StrategyPicker({
  plans,
  selected,
  onSelect,
}: StrategyPickerProps) {
  const { t } = useI18n();
  const baseId = useId();
  const legendId = `${baseId}-legend`;

  if (plans.length === 0) {
    return null;
  }

  return (
    <div>
      <p
        id={legendId}
        className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
      >
        {t("admin.routes.assistant.strategyPicker.legend")}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={legendId}
        className="mt-2 grid gap-2 md:grid-cols-3"
      >
        {plans.map((plan) => {
          const optionId = `${baseId}-${plan.strategy}`;
          const isSelected = selected === plan.strategy;
          return (
            <label
              key={plan.strategy}
              htmlFor={optionId}
              data-selected={isSelected ? "true" : undefined}
              className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${
                isSelected
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <input
                id={optionId}
                type="radio"
                name={`${baseId}-strategy`}
                value={plan.strategy}
                checked={isSelected}
                onChange={() => onSelect(plan.strategy)}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">
                  {t(`admin.routes.assistant.strategies.${plan.strategy}.name`)}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {t(`admin.routes.assistant.strategies.${plan.strategy}.hint`)}
                </span>
                <span className="mt-2 block text-xs font-medium text-slate-700">
                  {[
                    t("admin.routes.assistant.strategyPicker.drive", {
                      drive: formatMinutes(plan.summary.totalDriveMinutes),
                    }),
                    t.plural("admin.routes.assistant.summary.stops", plan.summary.totalStops),
                    t.plural(
                      "admin.routes.assistant.strategyPicker.conflicts",
                      plan.summary.conflicts
                    ),
                  ].join(" · ")}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
