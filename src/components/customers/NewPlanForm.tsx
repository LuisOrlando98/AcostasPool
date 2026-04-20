"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { GLOBAL_RECURRING_PLAN_OPTIONS } from "@/lib/jobs/recurring-plan-templates";
import FormSubmitButton from "@/components/ui/FormSubmitButton";

type Property = { id: string; name: string | null; address: string };
type Technician = { id: string; user: { fullName: string } };
type TierOption = { id: string; name: string };

type Props = {
  customerId: string;
  properties: Property[];
  technicians: Technician[];
  tierOptions: TierOption[];
  defaultTierId: string | undefined;
  createAction: (formData: FormData) => Promise<void>;
};

export default function NewPlanForm({
  customerId,
  properties,
  technicians,
  tierOptions,
  defaultTierId,
  createAction,
}: Props) {
  const { t } = useI18n();
  const [frequency, setFrequency] = useState<"WEEKLY" | "BIWEEKLY" | "MONTHLY">("WEEKLY");
  const isBiweekly = frequency === "BIWEEKLY";

  return (
    <form action={createAction} className="mt-5 space-y-4">
      <input type="hidden" name="customerId" value={customerId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("admin.customers.detail.plans.fields.frequency")}
          </label>
          <select
            name="frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as "WEEKLY" | "BIWEEKLY" | "MONTHLY")}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="WEEKLY">{t("plans.frequency.weekly")}</option>
            <option value="BIWEEKLY">{t("plans.frequency.biweekly")}</option>
            <option value="MONTHLY">{t("plans.frequency.monthly")}</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("admin.routes.labels.property")}
          </label>
          <select
            name="propertyId"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            required
          >
            {properties.length === 0 ? (
              <option value="">{t("admin.routes.labels.noProperties")}</option>
            ) : (
              properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ? `${p.name} · ${p.address}` : p.address}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {isBiweekly
              ? t("admin.customers.detail.plans.fields.weeklyRouteDay1")
              : t("admin.customers.detail.plans.fields.weeklyRoute")}
          </label>
          <select
            name="planTemplate"
            defaultValue={GLOBAL_RECURRING_PLAN_OPTIONS[0]?.value}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            required
          >
            {GLOBAL_RECURRING_PLAN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
        {isBiweekly && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("admin.customers.detail.plans.fields.weeklyRouteDay2")}
            </label>
            <select
              name="planTemplate2"
              defaultValue={GLOBAL_RECURRING_PLAN_OPTIONS[2]?.value ?? GLOBAL_RECURRING_PLAN_OPTIONS[1]?.value}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              required
            >
              {GLOBAL_RECURRING_PLAN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("jobs.detail.fields.serviceTier")}
          </label>
          <select
            name="serviceTierId"
            defaultValue={defaultTierId}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            {tierOptions.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("jobs.detail.fields.tech")}
          </label>
          <select
            name="technicianId"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            required
          >
            <option value="">{t("admin.customers.detail.plans.placeholders.selectTechnician")}</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.user.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("admin.customers.detail.plans.fields.startDate")}
          </label>
          <input
            name="nextDate"
            type="date"
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("jobs.detail.fields.duration")}
          </label>
          <input
            name="estimatedDuration"
            type="number"
            min="0"
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="60"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t("admin.customers.detail.plans.fields.notes")}
        </label>
        <textarea
          name="notes"
          className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </div>

      <FormSubmitButton
        idleLabel={t("admin.customers.detail.actions.createPlan")}
        pendingLabel={t("admin.customers.detail.actions.saving")}
        successLabel={t("common.feedback.created")}
        className="w-full"
      />
    </form>
  );
}
