"use client";

import { useMemo, useState } from "react";
import AddressAutocompleteSingle from "@/components/ui/AddressAutocompleteSingle";
import { useI18n } from "@/i18n/client";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { SERVICE_PAYMENT_TYPE_VALUES } from "@/lib/customers/service-payment-info";
import {
  POOL_CONDITION_ITEM_KEYS,
  POOL_CONDITION_STATUS_VALUES,
  type PoolConditionEntry,
  type PoolConditionStatus,
} from "@/lib/customers/pool-condition";

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
  filterBrand: string | null;
  filterModel: string | null;
  pumpBrand: string | null;
  pumpHorsepower: string | null;
  poolCondition: PoolConditionEntry[];
  poolConditionNotes: string | null;
};

const CONDITION_STATUS_STYLES: Record<
  PoolConditionStatus,
  { idle: string; active: string; solid: string }
> = {
  BROKEN: {
    idle: "border-rose-300 bg-rose-50",
    active: "border-rose-600 bg-rose-500 ring-2 ring-rose-200",
    solid: "border-rose-600 bg-rose-500",
  },
  BAD: {
    idle: "border-amber-300 bg-amber-50",
    active: "border-amber-500 bg-amber-400 ring-2 ring-amber-200",
    solid: "border-amber-500 bg-amber-400",
  },
  GOOD: {
    idle: "border-emerald-300 bg-emerald-50",
    active: "border-emerald-600 bg-emerald-500 ring-2 ring-emerald-200",
    solid: "border-emerald-600 bg-emerald-500",
  },
};

type AdminCustomerPropertiesProps = {
  customerId: string;
  rows: PropertyRow[];
  addPropertyTargetId: string;
  onUpdateProperty: (formData: FormData) => Promise<void>;
  onDeleteProperty: (formData: FormData) => Promise<void>;
};

const PAGE_SIZE = 6;

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
  const [listOpen, setListOpen] = useState(false);
  const [conditionDraft, setConditionDraft] = useState<
    Record<string, PoolConditionStatus | null>
  >({});

  const conditionLabel = (key: (typeof POOL_CONDITION_ITEM_KEYS)[number]) =>
    t(`admin.customers.detail.properties.condition.items.${key}`);
  const conditionStatusLabel = (status: PoolConditionStatus) =>
    t(`admin.customers.detail.properties.condition.status.${status}`);

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
    const property = rows.find((row) => row.id === propertyId);
    const draft: Record<string, PoolConditionStatus | null> = {};
    for (const key of POOL_CONDITION_ITEM_KEYS) {
      draft[key] =
        property?.poolCondition.find((entry) => entry.key === key)?.status ?? null;
    }
    setConditionDraft(draft);
  };

  const closePropertyEditor = () => {
    setConfirmDelete(false);
    setActivePropertyId(null);
    setConditionDraft({});
  };

  const poolTypeOptions = [
    { value: "Concreto", label: t("admin.customers.detail.properties.options.concrete") },
    { value: "Fibra", label: t("admin.customers.detail.properties.options.fiberglass") },
    { value: "Vinilo", label: t("admin.customers.detail.properties.options.vinyl") },
    {
      value: "Material alternativo",
      label: t("admin.customers.detail.properties.options.altMaterial"),
    },
    { value: "Jacuzzi", label: t("admin.customers.detail.properties.options.jacuzzi") },
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
      <section
        className={`customers-panel ui-panel min-w-0 overflow-hidden p-4 sm:p-6 ${
          listOpen ? "flex h-full flex-col lg:min-h-[360px]" : ""
        }`}
      >
        <div className="flex min-h-[40px] flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setListOpen((value) => !value)}
            aria-expanded={listOpen}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-transform duration-200 ${
                listOpen ? "" : "-rotate-90"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3.5 w-3.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold">
                {t("admin.customers.detail.sections.propertiesTitle")}
              </span>
              <span className="block text-sm text-slate-500">
                {t("admin.customers.detail.sections.propertiesSubtitle")}
              </span>
            </span>
          </button>
          <label
            htmlFor={addPropertyTargetId}
            className="app-button-primary shrink-0 cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
          >
            {t("admin.customers.detail.actions.addProperty")}
          </label>
        </div>

        <div
          className={`mt-4 min-h-0 flex-1 overflow-y-auto pr-1 ${listOpen ? "" : "hidden"}`}
        >
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
                      {property.filterBrand || property.filterModel || property.pumpBrand || property.pumpHorsepower ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {property.filterBrand || property.filterModel
                            ? `${t("admin.customers.detail.properties.equipment.filter")}: ${[property.filterBrand, property.filterModel].filter(Boolean).join(" ")}`
                            : null}
                          {(property.filterBrand || property.filterModel) && (property.pumpBrand || property.pumpHorsepower)
                            ? " | "
                            : null}
                          {property.pumpBrand || property.pumpHorsepower
                            ? `${t("admin.customers.detail.properties.equipment.pump")}: ${[property.pumpBrand, property.pumpHorsepower].filter(Boolean).join(" ")}`
                            : null}
                        </p>
                      ) : null}
                      {property.poolCondition.some((entry) => entry.status) ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {property.poolCondition
                            .filter((entry) => entry.status)
                            .map((entry) => (
                              <span
                                key={entry.key}
                                title={`${conditionLabel(entry.key)}: ${conditionStatusLabel(entry.status as PoolConditionStatus)}`}
                                className={`h-2.5 w-2.5 rounded-full border ${CONDITION_STATUS_STYLES[entry.status as PoolConditionStatus].solid}`}
                              />
                            ))}
                        </div>
                      ) : null}
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

        {rows.length > 0 && listOpen ? (
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
                    {t("admin.customers.detail.properties.edit.sections.equipment")}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t("admin.customers.detail.properties.equipment.filter")}
                      </p>
                      <div className="mt-2 grid gap-2">
                        <div>
                          <label className="app-modal-field-label">
                            {t("admin.customers.detail.properties.equipment.brand")}
                          </label>
                          <input
                            name="filterBrand"
                            defaultValue={activeProperty.filterBrand ?? ""}
                            className="app-input app-modal-input"
                            placeholder={t(
                              "admin.customers.detail.properties.equipment.brandPlaceholder"
                            )}
                          />
                        </div>
                        <div>
                          <label className="app-modal-field-label">
                            {t("admin.customers.detail.properties.equipment.model")}
                          </label>
                          <input
                            name="filterModel"
                            defaultValue={activeProperty.filterModel ?? ""}
                            className="app-input app-modal-input"
                            placeholder={t(
                              "admin.customers.detail.properties.equipment.modelPlaceholder"
                            )}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t("admin.customers.detail.properties.equipment.pump")}
                      </p>
                      <div className="mt-2 grid gap-2">
                        <div>
                          <label className="app-modal-field-label">
                            {t("admin.customers.detail.properties.equipment.brand")}
                          </label>
                          <input
                            name="pumpBrand"
                            defaultValue={activeProperty.pumpBrand ?? ""}
                            className="app-input app-modal-input"
                            placeholder={t(
                              "admin.customers.detail.properties.equipment.brandPlaceholder"
                            )}
                          />
                        </div>
                        <div>
                          <label className="app-modal-field-label">
                            {t("admin.customers.detail.properties.equipment.horsepower")}
                          </label>
                          <input
                            name="pumpHorsepower"
                            defaultValue={activeProperty.pumpHorsepower ?? ""}
                            className="app-input app-modal-input"
                            placeholder={t(
                              "admin.customers.detail.properties.equipment.horsepowerPlaceholder"
                            )}
                          />
                        </div>
                      </div>
                    </div>
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
                  <p className="app-modal-section-title">
                    {t("admin.customers.detail.properties.condition.sectionTitle")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("admin.customers.detail.properties.condition.sectionHint")}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {POOL_CONDITION_ITEM_KEYS.map((key) => {
                      const currentStatus = conditionDraft[key] ?? null;
                      return (
                        <div
                          key={key}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                        >
                          <span className="text-sm text-slate-700">
                            {conditionLabel(key)}
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="hidden"
                              name={`condition_${key}`}
                              value={currentStatus ?? ""}
                            />
                            {POOL_CONDITION_STATUS_VALUES.map((status) => (
                              <button
                                key={status}
                                type="button"
                                title={conditionStatusLabel(status)}
                                aria-pressed={currentStatus === status}
                                onClick={() =>
                                  setConditionDraft((prev) => ({ ...prev, [key]: status }))
                                }
                                className={`h-6 w-6 rounded-full border-2 transition ${
                                  currentStatus === status
                                    ? CONDITION_STATUS_STYLES[status].active
                                    : CONDITION_STATUS_STYLES[status].idle
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <label className="app-modal-field-label">
                      {t("admin.customers.detail.properties.condition.notes")}
                    </label>
                    <textarea
                      name="poolConditionNotes"
                      defaultValue={activeProperty.poolConditionNotes ?? ""}
                      className="app-input app-modal-input app-modal-input-textarea"
                      placeholder={t(
                        "admin.customers.detail.properties.condition.notesPlaceholder"
                      )}
                    />
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
