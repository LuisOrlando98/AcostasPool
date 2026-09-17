"use client";

import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { useI18n } from "@/i18n/client";
import { GLOBAL_RECURRING_PLAN_OPTIONS } from "@/lib/jobs/recurring-plan-templates";
import ActionForm from "./ActionForm";
import CustomerDetailFormModal from "./CustomerDetailFormModal";
import type { CustomerDetailFormAction } from "./action-result";
import type {
  PropertyOption,
  ServiceTierOption,
  TechnicianOption,
} from "./types";

type NewPlanModalProps = {
  customerId: string;
  properties: PropertyOption[];
  technicians: TechnicianOption[];
  tierOptions: ServiceTierOption[];
  defaultTierId: string | undefined;
  action: CustomerDetailFormAction;
};

export default function NewPlanModal({
  customerId,
  properties,
  technicians,
  tierOptions,
  defaultTierId,
  action,
}: NewPlanModalProps) {
  const { t } = useI18n();

  return (
    <CustomerDetailFormModal
      modal="new-plan"
      kicker={t("admin.customers.detail.plans.modalKicker")}
      title={t("admin.customers.detail.plans.modalTitle")}
      subtitle={t("admin.customers.detail.plans.modalSubtitle")}
    >
      <ActionForm action={action} className="mt-5 space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("admin.customers.detail.plans.fields.weeklyRoute")}
            </label>
            <select
              name="planTemplate"
              defaultValue={GLOBAL_RECURRING_PLAN_OPTIONS[0]?.value}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              required
            >
              {GLOBAL_RECURRING_PLAN_OPTIONS.map((planOption) => (
                <option key={planOption.value} value={planOption.value}>
                  {t(planOption.labelKey)}
                </option>
              ))}
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
                properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name
                      ? `${property.name} · ${property.address}`
                      : property.address}
                  </option>
                ))
              )}
            </select>
          </div>
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
      </ActionForm>
    </CustomerDetailFormModal>
  );
}
