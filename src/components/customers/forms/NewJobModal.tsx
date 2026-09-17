import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import ActionForm from "./ActionForm";
import type { CustomerDetailFormAction } from "./action-result";
import type {
  PropertyOption,
  ServiceTierOption,
  TechnicianOption,
  Translator,
} from "./types";

type NewJobModalProps = {
  t: Translator;
  customerId: string;
  properties: PropertyOption[];
  technicians: TechnicianOption[];
  tierOptions: ServiceTierOption[];
  action: CustomerDetailFormAction;
};

export default function NewJobModal({
  t,
  customerId,
  properties,
  technicians,
  tierOptions,
  action,
}: NewJobModalProps) {
  return (
    <div className="app-modal-layer fixed inset-0 z-[2200] hidden items-center justify-center overflow-y-auto p-3 sm:p-6 peer-checked/job:flex">
      <label
        htmlFor="new-job"
        className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
      />
      <div className="app-modal-card relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
          <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {t("admin.customers.detail.jobs.modalKicker")}
              </p>
              <h2 className="text-lg font-semibold">
                {t("admin.customers.detail.jobs.modalTitle")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("admin.customers.detail.jobs.modalSubtitle")}
              </p>
            </div>
            <label
              htmlFor="new-job"
              className="app-modal-close"
              aria-label={t("common.actions.close")}
              title={t("common.actions.close")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </label>
          </div>
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
        </div>
      </div>
    </div>
  );
}
