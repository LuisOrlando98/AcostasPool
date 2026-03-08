"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { formatUsPhone } from "@/lib/phones";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  propertyNames: string[];
  status: string;
  properties: number;
  jobs: number;
  invoices: number;
};

type SortKey = "name" | "jobs" | "properties";

type DraftFilters = {
  query: string;
  status: string;
  sort: SortKey;
};

export default function CustomersOverview({
  rows,
  summary,
  pagination,
  filters,
  createTargetId,
  onCreate,
}: {
  rows: CustomerRow[];
  summary: {
    total: number;
    active: number;
    inactive: number;
    properties: number;
    jobs: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    query: string;
    status: string;
    sort: string;
  };
  createTargetId?: string;
  onCreate?: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState(filters.query);
  const [statusFilter, setStatusFilter] = useState(filters.status);
  const [sortKey, setSortKey] = useState<SortKey>(filters.sort as SortKey);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draftFilters, setDraftFilters] = useState<DraftFilters>({
    query: filters.query,
    status: filters.status,
    sort: filters.sort as SortKey,
  });
  const clearFiltersLabel = locale === "es" ? "Limpiar filtros" : "Clear filters";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSearch(filters.query);
    setStatusFilter(filters.status);
    setSortKey(filters.sort as SortKey);
    setDraftFilters({
      query: filters.query,
      status: filters.status,
      sort: filters.sort as SortKey,
    });
  }, [filters.query, filters.status, filters.sort]);

  useEffect(() => {
    if (!isFiltersOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFiltersOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isFiltersOpen]);

  useEffect(() => {
    if (!isFiltersOpen) {
      return;
    }
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [isFiltersOpen]);

  const pushFilters = (next: {
    query?: string;
    status?: string;
    sort?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const nextQuery = next.query ?? search;
    const nextStatus = next.status ?? statusFilter;
    const nextSort = next.sort ?? sortKey;
    const nextPage = next.page ?? pagination.page;

    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    }
    if (nextStatus && nextStatus !== "ALL") {
      params.set("status", nextStatus);
    }
    if (nextSort && nextSort !== "name") {
      params.set("sort", nextSort);
    }
    if (nextPage && nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const queryString = params.toString();
    router.push(queryString ? `/admin/customers?${queryString}` : "/admin/customers");
  };

  const hasActiveFilters =
    search.trim().length > 0 || statusFilter !== "ALL" || sortKey !== "name";
  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (statusFilter !== "ALL" ? 1 : 0) +
    (sortKey !== "name" ? 1 : 0);

  const openFiltersModal = () => {
    setDraftFilters({
      query: search,
      status: statusFilter,
      sort: sortKey,
    });
    setIsFiltersOpen(true);
  };

  const applyFilters = () => {
    const nextQuery = draftFilters.query;
    const nextStatus = draftFilters.status || "ALL";
    const nextSort = draftFilters.sort || "name";

    setSearch(nextQuery);
    setStatusFilter(nextStatus);
    setSortKey(nextSort);
    pushFilters({ query: nextQuery, status: nextStatus, sort: nextSort, page: 1 });
    setIsFiltersOpen(false);
  };

  const clearAllFilters = () => {
    const reset: DraftFilters = {
      query: "",
      status: "ALL",
      sort: "name",
    };
    setSearch(reset.query);
    setStatusFilter(reset.status);
    setSortKey(reset.sort);
    setDraftFilters(reset);
    pushFilters({ query: reset.query, status: reset.status, sort: reset.sort, page: 1 });
  };

  const createControl = onCreate ? (
    <button
      type="button"
      onClick={onCreate}
      className="app-button-primary w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] md:w-auto"
    >
      {t("admin.customers.overview.actions.new")}
    </button>
  ) : createTargetId ? (
    <label
      htmlFor={createTargetId}
      className="app-button-primary w-full cursor-pointer px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] md:w-auto"
    >
      {t("admin.customers.overview.actions.new")}
    </label>
  ) : null;

  const kpiCards = (
    <div className="customers-overview-kpis grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      <div className="app-card customers-kpi p-4 sm:p-5">
        <p className="break-words text-[10px] uppercase tracking-[0.22em] text-slate-400 sm:text-[11px] sm:tracking-[0.3em]">
          {t("admin.customers.overview.cards.customers")}
        </p>
        <p className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
          {summary.total}
        </p>
        <p className="text-xs text-slate-500">
          {t("admin.customers.overview.cards.total")}
        </p>
      </div>
      <div className="customers-kpi rounded-2xl border border-teal-200 bg-teal-50 p-4 sm:p-5">
        <p className="break-words text-[10px] uppercase tracking-[0.22em] text-teal-700 sm:text-[11px] sm:tracking-[0.3em]">
          {t("admin.customers.overview.cards.active")}
        </p>
        <p className="mt-2 text-xl font-semibold text-teal-900 sm:text-2xl">
          {summary.active}
        </p>
        <p className="text-xs text-teal-700">
          {t("admin.customers.overview.cards.activeHint")}
        </p>
      </div>
      <div className="customers-kpi rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5">
        <p className="break-words text-[10px] uppercase tracking-[0.22em] text-indigo-700 sm:text-[11px] sm:tracking-[0.3em]">
          {t("admin.customers.overview.cards.inactive")}
        </p>
        <p className="mt-2 text-xl font-semibold text-indigo-900 sm:text-2xl">
          {summary.inactive}
        </p>
        <p className="text-xs text-indigo-700">
          {t("admin.customers.overview.cards.inactiveHint")}
        </p>
      </div>
      <div className="customers-kpi rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
        <p className="break-words text-[10px] uppercase tracking-[0.22em] text-sky-700 sm:text-[11px] sm:tracking-[0.3em]">
          {t("admin.customers.overview.cards.properties")}
        </p>
        <p className="mt-2 text-xl font-semibold text-sky-900 sm:text-2xl">
          {summary.properties}
        </p>
        <p className="text-xs text-sky-700">
          {t("admin.customers.overview.cards.propertiesHint")}
        </p>
      </div>
    </div>
  );

  const filtersModal =
    mounted && isFiltersOpen
      ? createPortal(
          <div className="app-modal-layer fixed inset-0 z-[2400] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            <button
              type="button"
              onClick={() => setIsFiltersOpen(false)}
              className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
              aria-label={t("common.actions.close")}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("admin.customers.overview.filters.modalTitle")}
              className="app-modal-card relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                <div className="app-modal-header">
                  <div>
                    <p className="app-modal-kicker">
                      {t("admin.customers.overview.filters.open")}
                    </p>
                    <h3 className="app-modal-title">
                      {t("admin.customers.overview.filters.modalTitle")}
                    </h3>
                    <p className="app-modal-subtitle">
                      {t("admin.customers.overview.filters.modalSubtitle")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFiltersOpen(false)}
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
                      {t("admin.customers.overview.filters.open")}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="sm:col-span-2">
                        <span className="app-modal-field-label">
                          {t("common.actions.search")}
                        </span>
                        <input
                          value={draftFilters.query}
                          onChange={(event) =>
                            setDraftFilters((current) => ({
                              ...current,
                              query: event.target.value,
                            }))
                          }
                          placeholder={t("admin.customers.overview.placeholders.search")}
                          className="app-modal-input app-input"
                        />
                      </label>
                      <label>
                        <span className="app-modal-field-label">
                          {t("admin.customers.overview.filters.status")}
                        </span>
                        <select
                          value={draftFilters.status}
                          onChange={(event) =>
                            setDraftFilters((current) => ({
                              ...current,
                              status: event.target.value,
                            }))
                          }
                          className="app-modal-input app-input bg-white"
                        >
                          <option value="ALL">{t("admin.customers.overview.filters.status")}</option>
                          <option value="ACTIVE">{t("common.status.active")}</option>
                          <option value="INACTIVE">{t("common.status.inactive")}</option>
                        </select>
                      </label>
                      <label>
                        <span className="app-modal-field-label">
                          {t("admin.customers.overview.filters.sort")}
                        </span>
                        <select
                          value={draftFilters.sort}
                          onChange={(event) =>
                            setDraftFilters((current) => ({
                              ...current,
                              sort: event.target.value as SortKey,
                            }))
                          }
                          className="app-modal-input app-input bg-white"
                        >
                          <option value="name">{t("admin.customers.overview.sort.name")}</option>
                          <option value="jobs">{t("admin.customers.overview.sort.jobs")}</option>
                          <option value="properties">
                            {t("admin.customers.overview.sort.properties")}
                          </option>
                        </select>
                      </label>
                    </div>
                  </section>
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftFilters({ query: "", status: "ALL", sort: "name" })}
                    className="ui-button-ghost px-3 py-2 text-xs font-semibold"
                  >
                    {clearFiltersLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFiltersOpen(false)}
                    className="ui-button-ghost px-3 py-2 text-xs font-semibold"
                  >
                    {t("common.actions.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
                  >
                    {t("admin.customers.overview.filters.apply")}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <section className="customers-scope customers-overview space-y-4 sm:space-y-6">
        <div className="customers-overview-shell rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {t("admin.customers.overview.title")}
              </h2>
              <p className="text-xs text-slate-500">
                {t("admin.customers.overview.results", {
                  count: pagination.total,
                })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openFiltersModal}
                className="app-button-ghost relative inline-flex h-9 w-9 items-center justify-center rounded-full p-0"
                aria-label={t("admin.customers.overview.filters.open")}
                title={t("admin.customers.overview.filters.open")}
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
                <span className="sr-only">{t("admin.customers.overview.filters.open")}</span>
              </button>

              {activeFilterCount > 0 ? (
                <span className="app-chip px-3 py-1 text-xs" data-tone="info">
                  {t("admin.customers.overview.filters.activeCount", { count: activeFilterCount })}
                </span>
              ) : null}

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="ui-button-ghost px-3 py-2 text-xs font-semibold"
                >
                  {clearFiltersLabel}
                </button>
              ) : null}

              {createControl}
            </div>
          </div>

          <div className="mt-4">{kpiCards}</div>

          <div className="mt-4">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                {t("admin.customers.overview.empty")}
              </div>
            ) : (
              <div className="customers-table-shell ui-table-shell overflow-hidden">
                <div className="customers-table-scroll overflow-x-auto">
                  <table className="customers-table customers-overview-table w-full min-w-[1020px] table-fixed text-left text-xs text-slate-600 md:min-w-[1060px]">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-[10px] uppercase tracking-[0.06em] text-slate-100/85 sm:text-[11px] sm:tracking-[0.12em]">
                      <tr>
                        <th className="w-[18%] min-w-[11rem] whitespace-nowrap bg-slate-900 px-3 py-3 sm:px-4">{t("admin.customers.overview.table.customer")}</th>
                        <th className="w-[14%] min-w-[7rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.phone")}</th>
                        <th className="w-[22%] min-w-[11.5rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.address")}</th>
                        <th className="w-[21%] min-w-[11rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.properties")}</th>
                        <th className="w-[8%] min-w-[6rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.jobs")}</th>
                        <th className="w-[8%] min-w-[6rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.invoices")}</th>
                        <th className="w-[9%] min-w-[7rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {rows.map((customer) => {
                        const propertiesPreview = customer.propertyNames.join(", ");
                        return (
                          <tr
                            key={customer.id}
                            className="group cursor-pointer transition hover:bg-sky-50/45"
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/admin/customers/${customer.id}`)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                router.push(`/admin/customers/${customer.id}`);
                              }
                            }}
                          >
                            <td className="min-w-[13.5rem] px-4 py-3.5">
                              <p className="max-w-[12rem] truncate font-semibold text-slate-900" title={customer.name}>
                                {customer.name}
                              </p>
                              <p className="max-w-[12rem] truncate text-[11px] text-slate-400" title={customer.email}>
                                {customer.email}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-[11px] text-slate-600">
                              <p
                                className="max-w-[9rem] truncate"
                                title={
                                  formatUsPhone(customer.phone) ??
                                  customer.phone ??
                                  t("common.labels.notAvailable")
                                }
                              >
                                {formatUsPhone(customer.phone) ??
                                  customer.phone ??
                                  t("common.labels.notAvailable")}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p
                                className="customers-overview-address text-[11px] text-slate-600"
                                title={customer.address || ""}
                              >
                                {customer.address || t("common.labels.notAvailable")}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-[11px] font-semibold text-slate-700">
                                {customer.properties}
                              </p>
                              <p
                                className="mt-0.5 max-w-[18rem] truncate text-[11px] text-slate-500"
                                title={propertiesPreview}
                              >
                                {propertiesPreview || t("admin.routes.labels.noProperties")}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-center text-[11px] font-semibold text-slate-600">
                              {customer.jobs}
                            </td>
                            <td className="px-4 py-3.5 text-center text-[11px] font-semibold text-slate-600">
                              {customer.invoices}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                                  customer.status === "ACTIVE"
                                    ? "border-teal-200 bg-teal-50 text-teal-700"
                                    : "border-indigo-200 bg-indigo-50 text-indigo-700"
                                }`}
                              >
                                {customer.status === "ACTIVE"
                                  ? t("common.status.active")
                                  : t("common.status.inactive")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {pagination.totalPages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                {t("admin.customers.overview.page", {
                  page: pagination.page,
                  total: pagination.totalPages,
                })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => pushFilters({ page: Math.max(1, pagination.page - 1) })}
                  className={`rounded-full border px-3 py-1 font-semibold ${
                    pagination.page === 1
                      ? "border-slate-100 text-slate-300"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  disabled={pagination.page === 1}
                >
                  {t("admin.customers.overview.prev")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    pushFilters({
                      page: Math.min(pagination.totalPages, pagination.page + 1),
                    })
                  }
                  className={`rounded-full border px-3 py-1 font-semibold ${
                    pagination.page === pagination.totalPages
                      ? "border-slate-100 text-slate-300"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  disabled={pagination.page === pagination.totalPages}
                >
                  {t("admin.customers.overview.next")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      {filtersModal}
    </>
  );
}
