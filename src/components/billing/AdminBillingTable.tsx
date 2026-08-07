"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { SERVICE_PAYMENT_TYPE_VALUES } from "@/lib/customers/service-payment-info";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

type BillingRow = {
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  customerId: string;
  customerName: string;
  serviceStartDate: string | null;
  paymentDay: number | null;
  servicePrice: number | null;
  paymentType: string | null;
  paymentNotes: string | null;
};

type BillingDraft = {
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  customerId: string;
  customerName: string;
  serviceStartDate: string;
  paymentDay: string;
  servicePrice: string;
  paymentType: string;
  paymentNotes: string;
};

type BillingFilterState = {
  search: string;
  customerId: string;
  paymentType: string;
  notes: "ALL" | "WITH" | "WITHOUT";
  sort: "customer" | "property" | "startDate" | "paymentDay" | "price";
};

type AdminBillingTableProps = {
  rows: BillingRow[];
  updatePropertyBillingAction: (formData: FormData) => Promise<{ error?: string } | undefined>;
};

const DEFAULT_FILTERS: BillingFilterState = {
  search: "",
  customerId: "ALL",
  paymentType: "ALL",
  notes: "ALL",
  sort: "customer",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function toDraft(row: BillingRow): BillingDraft {
  return {
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    propertyAddress: row.propertyAddress,
    customerId: row.customerId,
    customerName: row.customerName,
    serviceStartDate: row.serviceStartDate ?? "",
    paymentDay: row.paymentDay?.toString() ?? "",
    servicePrice:
      row.servicePrice === null ? "" : row.servicePrice.toFixed(2),
    paymentType: row.paymentType ?? "",
    paymentNotes: row.paymentNotes ?? "",
  };
}

function buildPageItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    items.push("ellipsis-start");
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis-end");
  }

  items.push(totalPages);
  return items;
}

export default function AdminBillingTable({
  rows,
  updatePropertyBillingAction,
}: AdminBillingTableProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [filters, setFilters] = useState<BillingFilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] =
    useState<BillingFilterState>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState<BillingDraft | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!editing && !confirmOpen && !filtersOpen) {
      return;
    }
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [editing, confirmOpen, filtersOpen]);

  useEffect(() => {
    if (!editing && !confirmOpen && !filtersOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isPending) {
        return;
      }
      if (confirmOpen) {
        setConfirmOpen(false);
        return;
      }
      if (editing) {
        setEditing(null);
        return;
      }
      if (filtersOpen) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, editing, filtersOpen, isPending]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
      }),
    [locale]
  );

  const customerOptions = useMemo(
    () =>
      [...new Map(rows.map((row) => [row.customerId, row.customerName])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = filters.search.trim().toLowerCase();

    const nextRows = rows.filter((row) => {
      if (filters.customerId !== "ALL" && row.customerId !== filters.customerId) {
        return false;
      }
      if (filters.paymentType !== "ALL" && row.paymentType !== filters.paymentType) {
        return false;
      }
      if (filters.notes === "WITH" && !row.paymentNotes?.trim()) {
        return false;
      }
      if (filters.notes === "WITHOUT" && row.paymentNotes?.trim()) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const paymentTypeLabel = row.paymentType
        ? t(`admin.invoices.servicePayment.paymentTypes.${row.paymentType}`)
        : "";
      const haystack = [
        row.customerName,
        row.propertyName,
        row.propertyAddress,
        row.serviceStartDate ?? "",
        row.paymentDay?.toString() ?? "",
        row.servicePrice?.toFixed(2) ?? "",
        row.paymentType ?? "",
        paymentTypeLabel,
        row.paymentNotes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return nextRows.sort((left, right) => {
      switch (filters.sort) {
        case "property": {
          const propertyOrder = left.propertyName.localeCompare(right.propertyName);
          if (propertyOrder !== 0) {
            return propertyOrder;
          }
          return left.customerName.localeCompare(right.customerName);
        }
        case "startDate": {
          const leftValue = left.serviceStartDate ? Date.parse(left.serviceStartDate) : -1;
          const rightValue = right.serviceStartDate ? Date.parse(right.serviceStartDate) : -1;
          if (leftValue !== rightValue) {
            return rightValue - leftValue;
          }
          return left.customerName.localeCompare(right.customerName);
        }
        case "paymentDay": {
          const leftValue = left.paymentDay ?? 99;
          const rightValue = right.paymentDay ?? 99;
          if (leftValue !== rightValue) {
            return leftValue - rightValue;
          }
          return left.customerName.localeCompare(right.customerName);
        }
        case "price": {
          const leftValue = left.servicePrice ?? -1;
          const rightValue = right.servicePrice ?? -1;
          if (leftValue !== rightValue) {
            return rightValue - leftValue;
          }
          return left.customerName.localeCompare(right.customerName);
        }
        case "customer":
        default: {
          const customerOrder = left.customerName.localeCompare(right.customerName);
          if (customerOrder !== 0) {
            return customerOrder;
          }
          return left.propertyName.localeCompare(right.propertyName);
        }
      }
    });
  }, [filters, rows, t]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageItems = useMemo(
    () => buildPageItems(safeCurrentPage, totalPages),
    [safeCurrentPage, totalPages]
  );
  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safeCurrentPage]);
  const showingFrom =
    filteredRows.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const showingTo =
    filteredRows.length === 0
      ? 0
      : Math.min(safeCurrentPage * pageSize, filteredRows.length);
  const activeFilterCount = [
    filters.search.trim().length > 0,
    filters.customerId !== "ALL",
    filters.paymentType !== "ALL",
    filters.notes !== "ALL",
    filters.sort !== DEFAULT_FILTERS.sort,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const openEditor = (row: BillingRow) => {
    setConfirmOpen(false);
    setEditing(toDraft(row));
  };

  const closeEditor = () => {
    if (isPending) {
      return;
    }
    setConfirmOpen(false);
    setEditing(null);
  };

  const openFiltersModal = () => {
    setDraftFilters(filters);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setCurrentPage(1);
    setFiltersOpen(false);
  };

  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
    setFiltersOpen(false);
  };

  const saveDraft = () => {
    if (!editing) {
      return;
    }
    const formData = new FormData();
    formData.set("propertyId", editing.propertyId);
    formData.set("customerId", editing.customerId);
    formData.set("serviceStartDate", editing.serviceStartDate);
    formData.set("paymentDay", editing.paymentDay);
    formData.set("servicePrice", editing.servicePrice);
    formData.set("paymentType", editing.paymentType);
    formData.set("paymentNotes", editing.paymentNotes);

    setBillingError(null);
    startTransition(async () => {
      const result = await updatePropertyBillingAction(formData);
      if (result?.error) {
        setBillingError(result.error);
        return;
      }
      setConfirmOpen(false);
      setEditing(null);
      router.refresh();
    });
  };

  const getDraftPriceLabel = (value: string) => {
    const parsed = Number(value);
    if (!value || !Number.isFinite(parsed)) {
      return t("common.labels.notAvailable");
    }
    return currencyFormatter.format(parsed);
  };

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

  const filtersModal =
    typeof document !== "undefined" && filtersOpen
      ? createPortal(
          <div className="app-modal-layer fixed inset-0 z-[2350] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
              aria-label={t("common.actions.close")}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("admin.invoices.servicePayment.filters.modalTitle")}
              className="app-modal-card relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                <div className="app-modal-header">
                  <div>
                    <p className="app-modal-kicker">
                      {t("admin.invoices.servicePayment.filters.open")}
                    </p>
                    <h3 className="app-modal-title">
                      {t("admin.invoices.servicePayment.filters.modalTitle")}
                    </h3>
                    <p className="app-modal-subtitle">
                      {t("admin.invoices.servicePayment.filters.modalSubtitle")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="app-modal-close"
                    aria-label={t("common.actions.close")}
                    title={t("common.actions.close")}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <section className="app-modal-section">
                    <p className="app-modal-section-title">
                      {t("admin.invoices.servicePayment.filters.open")}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="sm:col-span-2">
                        <span className="app-modal-field-label">
                          {t("common.actions.search")}
                        </span>
                        <input
                          value={draftFilters.search}
                          onChange={(event) =>
                            setDraftFilters((current) => ({
                              ...current,
                              search: event.target.value,
                            }))
                          }
                          placeholder={t("admin.invoices.servicePayment.searchPlaceholder")}
                          className="app-modal-input app-input"
                        />
                      </label>
                      <label>
                        <span className="app-modal-field-label">
                          {t("admin.invoices.servicePayment.filters.customer")}
                        </span>
                        <select
                          value={draftFilters.customerId}
                          onChange={(event) =>
                            setDraftFilters((current) => ({
                              ...current,
                              customerId: event.target.value,
                            }))
                          }
                          className="app-modal-input app-input bg-white"
                        >
                          <option value="ALL">
                            {t("admin.invoices.servicePayment.filters.allCustomers")}
                          </option>
                          {customerOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="app-modal-field-label">
                          {t("admin.invoices.servicePayment.filters.paymentType")}
                        </span>
                        <select
                          value={draftFilters.paymentType}
                          onChange={(event) =>
                            setDraftFilters((current) => ({
                              ...current,
                              paymentType: event.target.value,
                            }))
                          }
                          className="app-modal-input app-input bg-white"
                        >
                          <option value="ALL">
                            {t("admin.invoices.servicePayment.filters.allPaymentTypes")}
                          </option>
                          {SERVICE_PAYMENT_TYPE_VALUES.map((value) => (
                            <option key={value} value={value}>
                              {t(`admin.invoices.servicePayment.paymentTypes.${value}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="app-modal-field-label">
                          {t("admin.invoices.servicePayment.filters.notes")}
                        </span>
                        <select
                          value={draftFilters.notes}
                          onChange={(event) =>
                            setDraftFilters((current) => ({
                              ...current,
                              notes: event.target.value as BillingFilterState["notes"],
                            }))
                          }
                          className="app-modal-input app-input bg-white"
                        >
                          <option value="ALL">
                            {t("admin.invoices.servicePayment.filters.notesAll")}
                          </option>
                          <option value="WITH">
                            {t("admin.invoices.servicePayment.filters.notesWith")}
                          </option>
                          <option value="WITHOUT">
                            {t("admin.invoices.servicePayment.filters.notesWithout")}
                          </option>
                        </select>
                      </label>
                      <label>
                        <span className="app-modal-field-label">
                          {t("admin.invoices.servicePayment.filters.sort")}
                        </span>
                        <select
                          value={draftFilters.sort}
                          onChange={(event) =>
                            setDraftFilters((current) => ({
                              ...current,
                              sort: event.target.value as BillingFilterState["sort"],
                            }))
                          }
                          className="app-modal-input app-input bg-white"
                        >
                          <option value="customer">
                            {t("admin.invoices.servicePayment.sort.customer")}
                          </option>
                          <option value="property">
                            {t("admin.invoices.servicePayment.sort.property")}
                          </option>
                          <option value="startDate">
                            {t("admin.invoices.servicePayment.sort.startDate")}
                          </option>
                          <option value="paymentDay">
                            {t("admin.invoices.servicePayment.sort.paymentDay")}
                          </option>
                          <option value="price">
                            {t("admin.invoices.servicePayment.sort.price")}
                          </option>
                        </select>
                      </label>
                    </div>
                  </section>
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="ui-button-ghost px-3 py-2 text-xs font-semibold"
                  >
                    {t("admin.invoices.servicePayment.filters.reset")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="ui-button-ghost px-3 py-2 text-xs font-semibold"
                  >
                    {t("common.actions.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
                  >
                    {t("admin.invoices.servicePayment.filters.apply")}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const modal =
    typeof document !== "undefined" && editing
      ? createPortal(
          <>
            <div className="app-modal-layer fixed inset-0 z-[2300] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
              <button
                type="button"
                className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
                aria-label={t("common.actions.close")}
                onClick={closeEditor}
              />
              <div className="app-modal-card relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        {t("admin.invoices.servicePayment.modalKicker")}
                      </p>
                      <h2 className="text-lg font-semibold">
                        {t("admin.invoices.servicePayment.modalTitle")}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {editing.propertyName}
                      </p>
                      {editing.propertyAddress.trim() &&
                      editing.propertyAddress !== editing.propertyName ? (
                        <p className="text-xs text-slate-400">
                          {editing.propertyAddress}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {`${t("admin.invoices.servicePayment.fields.customer")}: ${editing.customerName}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeEditor}
                      disabled={isPending}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
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

                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.serviceStartDate")}
                        </label>
                        <input
                          type="date"
                          value={editing.serviceStartDate}
                          onChange={(event) =>
                            setEditing((current) =>
                              current
                                ? {
                                    ...current,
                                    serviceStartDate: event.target.value,
                                  }
                                : current
                            )
                          }
                          className="app-input mt-2 w-full px-4 py-3 text-sm"
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
                          value={editing.paymentDay}
                          onChange={(event) =>
                            setEditing((current) =>
                              current
                                ? { ...current, paymentDay: event.target.value }
                                : current
                            )
                          }
                          className="app-input mt-2 w-full px-4 py-3 text-sm"
                          placeholder={t(
                            "admin.invoices.servicePayment.placeholders.paymentDay"
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.servicePrice")}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editing.servicePrice}
                          onChange={(event) =>
                            setEditing((current) =>
                              current
                                ? { ...current, servicePrice: event.target.value }
                                : current
                            )
                          }
                          className="app-input mt-2 w-full px-4 py-3 text-sm"
                          placeholder={t(
                            "admin.invoices.servicePayment.placeholders.servicePrice"
                          )}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.paymentType")}
                        </label>
                        <select
                          value={editing.paymentType}
                          onChange={(event) =>
                            setEditing((current) =>
                              current
                                ? { ...current, paymentType: event.target.value }
                                : current
                            )
                          }
                          className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                        >
                          <option value="">
                            {t(
                              "admin.invoices.servicePayment.placeholders.paymentType"
                            )}
                          </option>
                          {SERVICE_PAYMENT_TYPE_VALUES.map((value) => (
                            <option key={value} value={value}>
                              {t(
                                `admin.invoices.servicePayment.paymentTypes.${value}`
                              )}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("admin.invoices.servicePayment.fields.paymentNotes")}
                      </label>
                      <textarea
                        value={editing.paymentNotes}
                        onChange={(event) =>
                          setEditing((current) =>
                            current
                              ? { ...current, paymentNotes: event.target.value }
                              : current
                          )
                        }
                        className="app-input mt-2 min-h-[110px] w-full px-4 py-3 text-sm"
                        placeholder={t(
                          "admin.invoices.servicePayment.placeholders.paymentNotes"
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={closeEditor}
                      disabled={isPending}
                      className="app-button-ghost px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                    >
                      {t("common.actions.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      disabled={isPending}
                      className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                    >
                      {t("admin.invoices.servicePayment.actions.reviewSave")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {confirmOpen ? (
              <div className="app-modal-layer fixed inset-0 z-[2400] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
                <button
                  type="button"
                  className="app-modal-backdrop absolute inset-0 bg-slate-900/68"
                  aria-label={t("common.actions.close")}
                  onClick={() => setConfirmOpen(false)}
                />
                <div className="app-modal-card relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                  <div className="p-5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {t("admin.invoices.servicePayment.confirm.kicker")}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      {t("admin.invoices.servicePayment.confirm.title")}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {t("admin.invoices.servicePayment.confirm.subtitle", {
                        customer: editing.customerName,
                        property: editing.propertyName,
                      })}
                    </p>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.invoices.servicePayment.fields.customer")}
                          </p>
                          <p className="mt-1 text-slate-900">
                            {editing.customerName}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.invoices.servicePayment.fields.property")}
                          </p>
                          <p className="mt-1 text-slate-900">
                            {editing.propertyName}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t(
                              "admin.invoices.servicePayment.fields.serviceStartDate"
                            )}
                          </p>
                          <p className="mt-1 text-slate-900">
                            {formatServiceDate(editing.serviceStartDate || null)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.invoices.servicePayment.fields.paymentDay")}
                          </p>
                          <p className="mt-1 text-slate-900">
                            {editing.paymentDay
                              ? t("admin.invoices.servicePayment.dayOfMonth", {
                                  day: editing.paymentDay,
                                })
                              : t("common.labels.notAvailable")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.invoices.servicePayment.fields.servicePrice")}
                          </p>
                          <p className="mt-1 text-slate-900">
                            {getDraftPriceLabel(editing.servicePrice)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.invoices.servicePayment.fields.paymentType")}
                          </p>
                          <p className="mt-1 text-slate-900">
                            {editing.paymentType
                              ? t(
                                  `admin.invoices.servicePayment.paymentTypes.${editing.paymentType}`
                                )
                              : t("common.labels.notAvailable")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("admin.invoices.servicePayment.fields.paymentNotes")}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-slate-900">
                          {editing.paymentNotes.trim() ||
                            t("admin.invoices.servicePayment.emptyNotes")}
                        </p>
                      </div>
                    </div>

                    {billingError ? (
                      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {billingError}
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setConfirmOpen(false)}
                        disabled={isPending}
                        className="app-button-ghost px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                      >
                        {t("admin.invoices.servicePayment.confirm.back")}
                      </button>
                      <button
                        type="button"
                        onClick={saveDraft}
                        disabled={isPending}
                        className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isPending
                          ? t("admin.invoices.servicePayment.actions.saving")
                          : t("admin.invoices.servicePayment.confirm.confirm")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>,
          document.body
        )
      : null;

  return (
    <>
      <section className="app-card p-6 shadow-contrast">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 sm:flex">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <rect x="3" y="6" width="18" height="13" rx="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h4" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-semibold">
                {t("admin.invoices.servicePayment.title")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("admin.invoices.servicePayment.subtitle")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {t("admin.invoices.servicePayment.pagination.showing", {
                  from: showingFrom,
                  to: showingTo,
                  total: filteredRows.length,
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <span>{t("admin.invoices.servicePayment.pagination.pageSize")}</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent pr-1 text-xs text-slate-700 outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={openFiltersModal}
              className="app-button-ghost relative inline-flex h-9 w-9 items-center justify-center rounded-full p-0"
              aria-label={t("admin.invoices.servicePayment.filters.open")}
              title={t("admin.invoices.servicePayment.filters.open")}
            >
              {activeFilterCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-sky-500 sm:hidden" />
              ) : null}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              <span className="sr-only">
                {t("admin.invoices.servicePayment.filters.open")}
              </span>
            </button>

            {activeFilterCount > 0 ? (
              <span className="app-chip px-3 py-1 text-xs" data-tone="info">
                {t("admin.invoices.servicePayment.filters.activeCount", {
                  count: activeFilterCount,
                })}
              </span>
            ) : null}

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="ui-button-ghost px-3 py-2 text-xs font-semibold"
              >
                {t("admin.invoices.servicePayment.filters.reset")}
              </button>
            ) : null}

            <span className="app-chip px-3 py-1 text-xs" data-tone="info">
              {filteredRows.length}
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-[11px] uppercase tracking-[0.14em] text-slate-100/85">
                <tr>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.customer")}
                  </th>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.property")}
                  </th>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.serviceStartDate")}
                  </th>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.paymentDay")}
                  </th>
                  <th className="px-4 py-3 text-right">
                    {t("admin.invoices.servicePayment.table.price")}
                  </th>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.paymentType")}
                  </th>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.notes")}
                  </th>
                  <th className="px-4 py-3 text-right">
                    {t("admin.invoices.servicePayment.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                      {t("admin.invoices.servicePayment.empty")}
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr key={row.propertyId} className="transition hover:bg-sky-50/40">
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {row.customerName}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">
                          {row.propertyName}
                        </p>
                        {row.propertyAddress.trim() &&
                        row.propertyAddress !== row.propertyName ? (
                          <p className="max-w-[18rem] truncate text-xs text-slate-500">
                            {row.propertyAddress}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5">
                        {formatServiceDate(row.serviceStartDate)}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.paymentDay
                          ? t("admin.invoices.servicePayment.dayOfMonth", {
                              day: String(row.paymentDay),
                            })
                          : t("common.labels.notAvailable")}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                        {row.servicePrice === null
                          ? t("common.labels.notAvailable")
                          : currencyFormatter.format(row.servicePrice)}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.paymentType
                          ? t(
                              `admin.invoices.servicePayment.paymentTypes.${row.paymentType}`
                            )
                          : t("common.labels.notAvailable")}
                      </td>
                      <td className="px-4 py-3.5">
                        <p
                          className="max-w-[22rem] truncate"
                          title={row.paymentNotes ?? ""}
                        >
                          {row.paymentNotes?.trim() ||
                            t("admin.invoices.servicePayment.emptyNotes")}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openEditor(row)}
                          className="ui-button-ghost px-3 py-1.5 text-xs font-semibold"
                        >
                          {t("common.actions.edit")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filteredRows.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                {t("admin.invoices.servicePayment.pagination.showing", {
                  from: showingFrom,
                  to: showingTo,
                  total: filteredRows.length,
                })}
              </span>
              <span>
                {t("admin.invoices.servicePayment.pagination.page", {
                  page: safeCurrentPage,
                  total: totalPages,
                })}
              </span>
            </div>

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                  className={`rounded-full border px-3 py-1.5 font-semibold ${
                    safeCurrentPage === 1
                      ? "border-slate-100 text-slate-300"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  disabled={safeCurrentPage === 1}
                >
                  {t("admin.invoices.servicePayment.pagination.prev")}
                </button>

                {pageItems.map((item) =>
                  typeof item === "number" ? (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      className={`rounded-full border px-3 py-1.5 font-semibold ${
                        item === safeCurrentPage
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                      aria-current={item === safeCurrentPage ? "page" : undefined}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item} className="px-2 py-1.5 text-slate-400">
                      ...
                    </span>
                  )
                )}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((current) => Math.min(totalPages, current + 1))
                  }
                  className={`rounded-full border px-3 py-1.5 font-semibold ${
                    safeCurrentPage === totalPages
                      ? "border-slate-100 text-slate-300"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  disabled={safeCurrentPage === totalPages}
                >
                  {t("admin.invoices.servicePayment.pagination.next")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      {filtersModal}
      {modal}
    </>
  );
}
