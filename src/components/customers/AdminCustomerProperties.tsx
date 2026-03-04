"use client";

import { useEffect, useMemo, useState } from "react";
import AddressAutocompleteSingle from "@/components/ui/AddressAutocompleteSingle";
import { useI18n } from "@/i18n/client";
import FormSubmitButton from "@/components/ui/FormSubmitButton";

type PropertyRow = {
  id: string;
  name: string | null;
  address: string;
  poolType: string | null;
  sanitizerType: string | null;
  poolVolumeGallons: number | null;
  waterType: string | null;
  filterType: string | null;
  hasSpa: boolean;
  accessInfo: string | null;
  locationNotes: string | null;
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
  const { t } = useI18n();
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

  useEffect(() => {
    setConfirmDelete(false);
  }, [activePropertyId]);

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

  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
            className="cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
          >
            {t("admin.customers.detail.actions.addProperty")}
          </label>
        </div>

        <div className="mt-4 space-y-3">
          {pagedRows.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("admin.customers.detail.properties.empty")}
            </p>
          ) : (
            pagedRows.map((property) => (
              <article
                key={property.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
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
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePropertyId(property.id)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                  >
                    {t("common.actions.edit")}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        {rows.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
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
        <div className="fixed inset-0 z-[2300] flex items-start justify-center overflow-y-auto p-3 sm:p-6">
          <button
            type="button"
            aria-label={t("common.actions.close")}
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setActivePropertyId(null)}
          />
          <div className="relative z-[1] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {t("admin.customers.detail.properties.edit.summary")}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {activeProperty.name ||
                      t("admin.customers.detail.properties.nameFallback")}
                  </h3>
                  <p className="text-sm text-slate-500">{activeProperty.address}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePropertyId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300"
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

              <form action={onUpdateProperty} className="mt-5 space-y-4">
                <input type="hidden" name="propertyId" value={activeProperty.id} />
                <input type="hidden" name="customerId" value={customerId} />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.customers.detail.properties.fields.name")}
                    </label>
                    <input
                      name="name"
                      defaultValue={activeProperty.name ?? ""}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.routes.labels.poolType")}
                    </label>
                    <select
                      name="poolType"
                      defaultValue={activeProperty.poolType ?? ""}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
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
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.customers.detail.properties.fields.sanitizerType")}
                    </label>
                    <select
                      name="sanitizerType"
                      defaultValue={activeProperty.sanitizerType ?? ""}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
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

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.routes.labels.poolVolume")}
                    </label>
                    <input
                      name="poolVolumeGallons"
                      type="number"
                      defaultValue={activeProperty.poolVolumeGallons ?? ""}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.routes.labels.waterType")}
                    </label>
                    <input
                      name="waterType"
                      defaultValue={activeProperty.waterType ?? ""}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.routes.labels.filterType")}
                    </label>
                    <input
                      name="filterType"
                      defaultValue={activeProperty.filterType ?? ""}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.customers.detail.properties.fields.spa")}
                    </label>
                    <select
                      name="hasSpa"
                      defaultValue={activeProperty.hasSpa ? "yes" : "no"}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <option value="no">{t("common.labels.no")}</option>
                      <option value="yes">{t("common.labels.yes")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.customers.detail.properties.fields.accessInfo")}
                    </label>
                    <textarea
                      name="accessInfo"
                      defaultValue={activeProperty.accessInfo ?? ""}
                      className="mt-2 min-h-[88px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.customers.detail.properties.fields.locationNotes")}
                  </label>
                  <textarea
                    name="locationNotes"
                    defaultValue={activeProperty.locationNotes ?? ""}
                    className="mt-2 min-h-[88px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <FormSubmitButton
                    idleLabel={t("admin.customers.detail.actions.saveChanges")}
                    pendingLabel={t("admin.customers.detail.actions.saving")}
                    className="px-4 py-2 text-xs"
                  />
                </div>
              </form>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-rose-200 bg-rose-50/60 px-3 py-3">
                <label className="flex items-center gap-2 text-xs text-rose-700">
                  <input
                    type="checkbox"
                    checked={confirmDelete}
                    onChange={(event) => setConfirmDelete(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Confirm delete
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
                    className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition disabled:opacity-50"
                  >
                    {t("common.actions.delete")}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
