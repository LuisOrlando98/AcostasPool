"use client";

import { useMemo, useState } from "react";
import AddressAutocompleteSingle from "@/components/ui/AddressAutocompleteSingle";
import { useI18n } from "@/i18n/client";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { SERVICE_PAYMENT_TYPE_VALUES } from "@/lib/customers/service-payment-info";

type PropertyRow = {
  id: string;
  name: string | null;
  address: string;
  poolType: string | null;
  sanitizerType: string | null;
  poolVolumeGallons: number | null;
  filterType: string | null;
  hasSpa: boolean;
  accessLocationNotes: string | null;
  serviceStartDate: string | null;
  paymentDay: number | null;
  servicePrice: number | null;
  paymentType: string | null;
  paymentNotes: string | null;
};

type AdminCustomerPropertiesProps = {
  customerId: string;
  rows: PropertyRow[];
  addPropertyTargetId: string;
  onUpdateProperty: (formData: FormData) => Promise<void>;
  onDeleteProperty: (formData: FormData) => Promise<void>;
};

const PAGE_SIZE = 5;

export default function AdminCustomerProperties({
  customerId,
  rows,
  addPropertyTargetId,
  onUpdateProperty,
  onDeleteProperty,
}: AdminCustomerPropertiesProps) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [currentPage, rows]);

  const activeProperty = useMemo(
    () => rows.find((row) => row.id === activePropertyId) ?? null,
    [activePropertyId, rows]
  );

  const openPropertyEditor = (propertyId: string) => {
    setConfirmDelete(false);
    setActivePropertyId(propertyId);
  };

  const closePropertyEditor = () => {
    setConfirmDelete(false);
    setActivePropertyId(null);
  };

  const poolTypeOptions = [
    { value: "Concreto", label: t("admin.customers.detail.properties.options.concrete") },
    { value: "Fibra", label: t("admin.customers.detail.properties.options.fiberglass") },
    { value: "Vinilo", label: t("admin.customers.detail.properties.options.vinyl") },
    {
      value: "Material alternativo",
      label: t("admin.customers.detail.properties.options.altMaterial"),
    },
  ];
  const sanitizerOptions = [
    { value: "Sal", label: t("admin.customers.detail.properties.options.salt") },
    { value: "Cloro", label: t("admin.customers.detail.properties.options.chlorine") },
    { value: "Otro", label: t("admin.customers.detail.properties.options.other") },
  ];
  const filterOptions = [
    { value: "Arena", label: t("admin.customers.detail.properties.options.filterSand") },
    { value: "Cartucho", label: t("admin.customers.detail.properties.options.filterCartridge") },
    { value: "D.E.", label: t("admin.customers.detail.properties.options.filterDE") },
  ];
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
      }),
    [locale]
  );

  const formatServiceDate = (value: string | null) => {
    if (!value) {
      return t("common.labels.notAvailable");
    }
    const parsed = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return t("common.labels.notAvailable");
    }
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(parsed);
  };

  return (
    <>
      <section className="customers-panel ui-panel flex h-full min-w-0 flex-col overflow-hidden p-4 sm:p-6 lg:min-h-[360px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {t("admin.customers.detail.sections.propertiesTitle")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("admin.customers.detail.sections.propertiesSubtitle")}
            </p>
          </div>
          <label
            htmlFor={addPropertyTargetId}
            className="app-button-primary cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
          >
            {t("admin.customers.detail.actions.addProperty")}
          </label>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {pagedRows.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("admin.customers.detail.properties.empty")}
            </p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {pagedRows.map((property) => (
                <article
                  key={property.id}
                  className="customers-property-card rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-sky-200 hover:bg-sky-50/35"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900">
                        {property.name || t("admin.customers.detail.properties.nameFallback")}
                      </p>
                      <p
                        className="mt-1 max-w-[34rem] overflow-hidden text-sm text-slate-600"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                        title={property.address}
                      >
                        {property.address}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {property.poolType || t("admin.customers.detail.properties.poolFallback")}
                        {" | "}
                        {property.sanitizerType || t("admin.customers.detail.properties.systemFallback")}
                        {" | "}
                        {property.poolVolumeGallons
                          ? `${property.poolVolumeGallons} gal`
                          : t("admin.customers.detail.properties.volumeFallback")}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {t("admin.invoices.servicePayment.fields.serviceStartDate")}:
                        {" "}
                        {formatServiceDate(property.serviceStartDate)}
                        {" | "}
                        {t("admin.invoices.servicePayment.fields.paymentDay")}:
                        {" "}
                        {property.paymentDay
                          ? t("admin.invoices.servicePayment.dayOfMonth", {
                              day: String(property.paymentDay),
                            })
                          : t("common.labels.notAvailable")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("admin.invoices.servicePayment.fields.servicePrice")}:
                        {" "}
                        {property.servicePrice === null
                          ? t("common.labels.notAvailable")
                          : currencyFormatter.format(property.servicePrice)}
                        {" | "}
                        {t("admin.invoices.servicePayment.fields.paymentType")}:
                        {" "}
                        {property.paymentType
                          ? t(
                              `admin.invoices.servicePayment.paymentTypes.${property.paymentType}`
                            )
                          : t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPropertyEditor(property.id)}
                      className="ui-button-ghost px-3 py-1.5 text-xs font-semibold"
                    >
                      {t("common.actions.edit")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {rows.length > 0 ? (
          <div className="sticky bottom-0 z-[1] mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white pt-3 text-xs text-slate-500">
            <span>
              {`${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(
                currentPage * PAGE_SIZE,
                rows.length
              )} / ${rows.length}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage <= 1}
                className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {activeProperty ? (
        <div className="app-modal-layer fixed inset-0 z-[2300] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
          <button
            type="button"
            aria-label={t("common.actions.close")}
            className="app-modal-backdrop absolute inset-0"
            onClick={closePropertyEditor}
          />
          <div className="app-modal-card relative z-[1] w-full max-w-5xl overflow-hidden rounded-3xl border bg-white">
            <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
              <div className="app-modal-header">
                <div className="min-w-0">
                  <p className="app-modal-kicker">
                    {t("admin.customers.detail.properties.edit.summary")}
                  </p>
                  <h3 className="app-modal-title">
                    {activeProperty.name ||
                      t("admin.customers.detail.properties.nameFallback")}
                  </h3>
                  <p
                    className="app-modal-subtitle truncate sm:max-w-[42rem]"
                    title={activeProperty.address}
                  >
                    {activeProperty.address}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePropertyEditor}
                  className="app-modal-close"
                  aria-label={t("common.actions.close")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 6l12 12M18 6l-12 12"
                    />
                  </svg>
                </button>
              </div>

              <form action={onUpdateProperty} className="grid gap-3">
                <input type="hidden" name="propertyId" value={activeProperty.id} />
                <input type="hidden" name="customerId" value={customerId} />

                <section className="app-modal-section">
                  <p className="app-modal-section-title">
                    {t("admin.customers.detail.properties.edit.sections.identity")}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="app-modal-field-label">
                        {t("admin.customers.detail.properties.fields.name")}
                      </label>
                      <input
                        name="name"
                        defaultValue={activeProperty.name ?? ""}
                        className="app-input app-modal-input"
                        placeholder={t("admin.customers.detail.properties.placeholders.name")}
                      />
                    </div>
                    <AddressAutocompleteSingle
                      name="address"
                      label={t("admin.routes.labels.address")}
                      defaultValue={activeProperty.address}
                      placeholder={t("admin.customers.detail.properties.placeholders.address")}
                      required
                    />
                  </div>
                </section>

                <section className="app-modal-section">
                  <p className="app-modal-section-title">
                    {t("admin.customers.detail.properties.edit.sections.specs")}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="app-modal-field-label">
                        {t("admin.routes.labels.poolType")}
                      </label>
                      <select
                        name="poolType"
                        defaultValue={activeProperty.poolType ?? ""}
                        className="app-input app-modal-input bg-white"
                      >
                        <option value="">
                          {t("admin.customers.detail.properties.options.select")}
                        </option>
                        {poolTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="app-modal-field-label">
                        {t("admin.customers.detail.properties.fields.sanitizerType")}
                      </label>
                      <select
                        name="sanitizerType"
                        defaultValue={activeProperty.sanitizerType ?? ""}
                        className="app-input app-modal-input bg-white"
                      >
                        <option value="">
                          {t("admin.customers.detail.properties.options.select")}
                        </option>
                        {sanitizerOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="app-modal-field-label">
                        {t("admin.routes.labels.poolVolume")}
                      </label>
                      <input
                        name="poolVolumeGallons"
                        type="number"
                        defaultValue={activeProperty.poolVolumeGallons ?? ""}
                        className="app-input app-modal-input"
                      />
                    </div>
                    <div>
                      <label className="app-modal-field-label">
                        {t("admin.routes.labels.filterType")}
                      </label>
                      <select
                        name="filterType"
                        defaultValue={activeProperty.filterType ?? ""}
                        className="app-input app-modal-input bg-white"
                      >
                        <option value="">
                          {t("admin.customers.detail.properties.options.select")}
                        </option>
                        {filterOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 max-w-[20rem]">
                    <label className="app-modal-field-label">
                      {t("admin.customers.detail.properties.fields.spa")}
                    </label>
                    <select
                      name="hasSpa"
                      defaultValue={activeProperty.hasSpa ? "yes" : "no"}
                      className="app-input app-modal-input bg-white"
                    >
                      <option value="no">{t("common.labels.no")}</option>
                      <option value="yes">{t("common.labels.yes")}</option>
                    </select>
                  </div>
                </section>

                <section className="app-modal-section">
                  <p className="app-modal-section-title">
                    {t("admin.customers.detail.properties.edit.sections.access")}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="app-modal-field-label">
                        {t("admin.customers.detail.properties.fields.accessLocationNotes")}
                      </label>
                      <textarea
                        name="accessLocationNotes"
                        defaultValue={activeProperty.accessLocationNotes ?? ""}
                        className="app-input app-modal-input app-modal-input-textarea"
                        placeholder={t(
                          "admin.customers.detail.properties.placeholders.accessLocationNotes"
                        )}
                      />
                    </div>
                  </div>
                </section>

                <section className="app-modal-section">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="app-modal-section-title">
                        {t("admin.invoices.servicePayment.sectionTitle")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("admin.invoices.servicePayment.adminOnly")}
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                      {t("admin.invoices.servicePayment.adminBadge")}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="app-modal-field-label">
                        {t("admin.invoices.servicePayment.fields.serviceStartDate")}
                      </label>
                      <input
                        type="date"
                        name="serviceStartDate"
                        defaultValue={activeProperty.serviceStartDate ?? ""}
                        className="app-input app-modal-input"
                      />
                    </div>
                    <div>
                      <label className="app-modal-field-label">
                        {t("admin.invoices.servicePayment.fields.paymentDay")}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        name="paymentDay"
                        defaultValue={activeProperty.paymentDay ?? ""}
                        className="app-input app-modal-input"
                        placeholder={t(
                          "admin.invoices.servicePayment.placeholders.paymentDay"
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="app-modal-field-label">
                        {t("admin.invoices.servicePayment.fields.servicePrice")}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="servicePrice"
                        defaultValue={
                          activeProperty.servicePrice !== null
                            ? activeProperty.servicePrice.toFixed(2)
                            : ""
                        }
                        className="app-input app-modal-input"
                        placeholder={t(
                          "admin.invoices.servicePayment.placeholders.servicePrice"
                        )}
                      />
                    </div>
                    <div>
                      <label className="app-modal-field-label">
                        {t("admin.invoices.servicePayment.fields.paymentType")}
                      </label>
                      <select
                        name="paymentType"
                        defaultValue={activeProperty.paymentType ?? ""}
                        className="app-input app-modal-input bg-white"
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
                    <label className="app-modal-field-label">
                      {t("admin.invoices.servicePayment.fields.paymentNotes")}
                    </label>
                    <textarea
                      name="paymentNotes"
                      defaultValue={activeProperty.paymentNotes ?? ""}
                      className="app-input app-modal-input app-modal-input-textarea"
                      placeholder={t(
                        "admin.invoices.servicePayment.placeholders.paymentNotes"
                      )}
                    />
                  </div>
                </section>

                <div className="app-modal-actions">
                  <FormSubmitButton
                    idleLabel={t("admin.customers.detail.actions.saveChanges")}
                    pendingLabel={t("admin.customers.detail.actions.saving")}
                    className="px-4 py-2 text-xs"
                  />
                </div>
              </form>

              <section className="app-modal-danger mt-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="app-modal-danger-title">
                      {t("admin.customers.detail.properties.edit.danger.title")}
                    </p>
                    <p className="app-modal-danger-subtitle">
                      {t("admin.customers.detail.properties.edit.danger.subtitle")}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-rose-700">
                    <input
                      type="checkbox"
                      checked={confirmDelete}
                      onChange={(event) => setConfirmDelete(event.target.checked)}
                      className="h-4 w-4 rounded border-rose-300"
                    />
                    {t("admin.customers.detail.properties.edit.danger.confirm")}
                  </label>
                  <form action={onDeleteProperty}>
                    <input type="hidden" name="propertyId" value={activeProperty.id} />
                    <input type="hidden" name="customerId" value={customerId} />
                    <input
                      type="hidden"
                      name="confirmDelete"
                      value={confirmDelete ? "yes" : "no"}
                    />
                    <button
                      type="submit"
                      disabled={!confirmDelete}
                      className="rounded-full border border-rose-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("common.actions.delete")}
                    </button>
                  </form>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
