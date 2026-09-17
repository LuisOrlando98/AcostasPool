import AddressAutocompleteSingle from "@/components/ui/AddressAutocompleteSingle";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { SERVICE_PAYMENT_TYPE_VALUES } from "@/lib/customers/service-payment-info";
import ActionForm from "./ActionForm";
import type { CustomerDetailFormAction } from "./action-result";
import type { Translator } from "./types";

type NewPropertyModalProps = {
  t: Translator;
  customerId: string;
  action: CustomerDetailFormAction;
};

export default function NewPropertyModal({
  t,
  customerId,
  action,
}: NewPropertyModalProps) {
  return (
    <div className="app-modal-layer fixed inset-0 z-[2200] hidden items-center justify-center overflow-y-auto p-3 sm:p-6 peer-checked/property:flex">
      <label
        htmlFor="new-property"
        className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
      />
      <div className="app-modal-card relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
          <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {t("admin.customers.detail.properties.modalKicker")}
              </p>
              <h2 className="text-lg font-semibold">
                {t("admin.customers.detail.properties.modalTitle")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("admin.customers.detail.properties.modalSubtitle")}
              </p>
            </div>
            <label
              htmlFor="new-property"
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.customers.detail.properties.fields.name")}
              </label>
              <input
                name="name"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                placeholder={t(
                  "admin.customers.detail.properties.placeholders.nameExample"
                )}
              />
            </div>
            <AddressAutocompleteSingle
              name="address"
              label={t("admin.routes.labels.address")}
              placeholder={t(
                "admin.customers.detail.properties.placeholders.address"
              )}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.routes.labels.poolType")}
              </label>
              <select
                name="poolType"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <option value="">
                  {t("admin.customers.detail.properties.options.select")}
                </option>
                <option value="Concreto">
                  {t("admin.customers.detail.properties.options.concrete")}
                </option>
                <option value="Fibra">
                  {t("admin.customers.detail.properties.options.fiberglass")}
                </option>
                <option value="Vinilo">
                  {t("admin.customers.detail.properties.options.vinyl")}
                </option>
                <option value="Material alternativo">
                  {t("admin.customers.detail.properties.options.altMaterial")}
                </option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.customers.detail.properties.fields.sanitizerType")}
              </label>
              <select
                name="sanitizerType"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <option value="">
                  {t("admin.customers.detail.properties.options.select")}
                </option>
                <option value="Sal">
                  {t("admin.customers.detail.properties.options.salt")}
                </option>
                <option value="Cloro">
                  {t("admin.customers.detail.properties.options.chlorine")}
                </option>
                <option value="Otro">
                  {t("admin.customers.detail.properties.options.other")}
                </option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("admin.routes.labels.filterType")}
            </label>
            <select
              name="filterType"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              defaultValue=""
            >
              <option value="">
                {t("admin.customers.detail.properties.options.select")}
              </option>
              <option value="Arena">
                {t("admin.customers.detail.properties.options.filterSand")}
              </option>
              <option value="Cartucho">
                {t("admin.customers.detail.properties.options.filterCartridge")}
              </option>
              <option value="D.E.">
                {t("admin.customers.detail.properties.options.filterDE")}
              </option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.routes.labels.poolVolume")}
              </label>
              <input
                name="poolVolumeGallons"
                type="number"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.customers.detail.properties.fields.spa")}
              </label>
              <select
                name="hasSpa"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <option value="no">{t("common.labels.no")}</option>
                <option value="yes">{t("common.labels.yes")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("admin.customers.detail.properties.fields.accessLocationNotes")}
            </label>
            <textarea
              name="accessLocationNotes"
              className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder={t("admin.customers.detail.properties.placeholders.accessLocationNotes")}
              required
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  {t("admin.invoices.servicePayment.sectionTitle")}
                </h3>
                <p className="text-xs text-slate-500">
                  {t("admin.invoices.servicePayment.adminOnly")}
                </p>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                {t("admin.invoices.servicePayment.adminBadge")}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.servicePayment.fields.serviceStartDate")}
                </label>
                <input
                  type="date"
                  name="serviceStartDate"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.servicePayment.fields.paymentDay")}
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  name="paymentDay"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder={t("admin.invoices.servicePayment.placeholders.paymentDay")}
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.servicePayment.fields.servicePrice")}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="servicePrice"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder={t("admin.invoices.servicePayment.placeholders.servicePrice")}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.servicePayment.fields.paymentType")}
                </label>
                <select
                  name="paymentType"
                  defaultValue=""
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="">
                    {t("admin.invoices.servicePayment.placeholders.paymentType")}
                  </option>
                  {SERVICE_PAYMENT_TYPE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {t(`admin.invoices.servicePayment.paymentTypes.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.invoices.servicePayment.fields.paymentNotes")}
              </label>
              <textarea
                name="paymentNotes"
                className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                placeholder={t("admin.invoices.servicePayment.placeholders.paymentNotes")}
              />
            </div>
          </div>
          <FormSubmitButton
            idleLabel={t("admin.customers.detail.actions.saveProperty")}
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
