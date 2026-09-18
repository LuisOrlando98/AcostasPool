"use client";

import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { useI18n } from "@/i18n/client";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import ActionForm from "./ActionForm";
import CustomerDetailFormModal from "./CustomerDetailFormModal";
import type { CustomerDetailFormAction } from "./action-result";
import type {
  PropertyOption,
  ServiceTierOption,
  TechnicianOption,
} from "./types";

type NewJobModalProps = {
  customerId: string;
  properties: PropertyOption[];
  technicians: TechnicianOption[];
  tierOptions: ServiceTierOption[];
  action: CustomerDetailFormAction;
};

export default function NewJobModal({
  customerId,
  properties,
  technicians,
  tierOptions,
  action,
}: NewJobModalProps) {
  const { t } = useI18n();

  return (
    <CustomerDetailFormModal
      modal="new-job"
      kicker={t("admin.customers.detail.jobs.modalKicker")}
      title={t("admin.customers.detail.jobs.modalTitle")}
      subtitle={t("admin.customers.detail.jobs.modalSubtitle")}
    >
      <ActionForm action={action} className="mt-5 space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("admin.routes.labels.date")}
            </label>
            <input
              name="scheduledDate"
              type="date"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("admin.routes.labels.time")}
            </label>
            <input
              name="scheduledTime"
              type="time"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("jobs.detail.fields.serviceTier")}
            </label>
            <select
              name="serviceTierId"
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
              {t("jobs.detail.fields.serviceType")}
            </label>
            <select
              name="serviceType"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              {serviceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.labelKey ? t(option.labelKey) : option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("jobs.detail.fields.priority")}
            </label>
            <select
              name="priority"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="NORMAL">{t("jobs.priority.normal")}</option>
              <option value="URGENT">{t("jobs.priority.urgent")}</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("admin.routes.labels.durationMinutes")}
            </label>
            <input
              name="estimatedDuration"
              type="number"
              min="0"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="60"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("jobs.detail.fields.tech")}
            </label>
            <select
              name="technicianId"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="">{t("admin.routes.labels.unassigned")}</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.user.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("jobs.detail.fields.jobType")}
          </label>
          <select
            name="type"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="ROUTINE">{t("jobs.type.routine")}</option>
            <option value="ON_DEMAND">{t("jobs.type.onDemand")}</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("common.labels.notes")}
          </label>
          <textarea
            name="notes"
            className="mt-2 min-h-[80px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </div>
        <FormSubmitButton
          idleLabel={t("admin.customers.detail.actions.createJob")}
          pendingLabel={t("admin.customers.detail.actions.saving")}
          successLabel={t("common.feedback.created")}
          className="w-full"
        />
      </ActionForm>
    </CustomerDetailFormModal>
  );
}
