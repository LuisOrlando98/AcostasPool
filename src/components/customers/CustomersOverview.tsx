"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { formatUsPhone } from "@/lib/phones";

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
  const [sortKey, setSortKey] = useState<"name" | "jobs" | "properties">(
    filters.sort as "name" | "jobs" | "properties"
  );
  const clearFiltersLabel = locale === "es" ? "Limpiar filtros" : "Clear filters";

  useEffect(() => {
    setSearch(filters.query);
    setStatusFilter(filters.status);
    setSortKey(filters.sort as "name" | "jobs" | "properties");
  }, [filters.query, filters.status, filters.sort]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.query) {
        pushFilters({ query: search, page: 1 });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [search, filters.query]);

  const hasActiveFilters =
    search.trim().length > 0 || statusFilter !== "ALL" || sortKey !== "name";
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

  return (
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
          {onCreate ? (
            <button
              type="button"
              onClick={onCreate}
              className="app-button-primary w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] sm:w-auto"
            >
              {t("admin.customers.overview.actions.new")}
            </button>
          ) : createTargetId ? (
            <label
              htmlFor={createTargetId}
              className="app-button-primary cursor-pointer px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] sm:w-auto"
            >
              {t("admin.customers.overview.actions.new")}
            </label>
          ) : null}
        </div>

        <div className="ui-filter-bar mt-4 grid gap-2 px-3 py-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-center">
          <label className="ui-search flex min-w-0 items-center gap-2 px-3 py-2 text-xs sm:col-span-2 xl:min-w-[240px] xl:flex-1">
            <span className="ui-search-icon">
              {t("common.actions.search")}
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("admin.customers.overview.placeholders.search")}
              className="ui-search-input w-full"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => {
              const nextValue = event.target.value;
              setStatusFilter(nextValue);
              pushFilters({ status: nextValue, page: 1 });
            }}
            className="ui-select w-full px-3 py-2 text-xs xl:w-[12rem]"
          >
            <option value="ALL">{t("admin.customers.overview.filters.status")}</option>
            <option value="ACTIVE">{t("common.status.active")}</option>
            <option value="INACTIVE">{t("common.status.inactive")}</option>
          </select>
          <select
            value={sortKey}
            onChange={(event) => {
              const nextValue = event.target.value as "name" | "jobs" | "properties";
              setSortKey(nextValue);
              pushFilters({ sort: nextValue, page: 1 });
            }}
            className="ui-select w-full px-3 py-2 text-xs xl:w-[13rem]"
          >
            <option value="name">{t("admin.customers.overview.sort.name")}</option>
            <option value="jobs">{t("admin.customers.overview.sort.jobs")}</option>
            <option value="properties">
              {t("admin.customers.overview.sort.properties")}
            </option>
          </select>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setSortKey("name");
                pushFilters({ query: "", status: "ALL", sort: "name", page: 1 });
              }}
              className="ui-button-ghost w-full px-3 py-2 text-xs font-semibold xl:ml-auto xl:w-auto"
            >
              {clearFiltersLabel}
            </button>
          ) : null}
        </div>

        <div className="mt-4">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              {t("admin.customers.overview.empty")}
            </div>
          ) : (
            <>
              <div className="customers-table-shell ui-table-shell overflow-hidden">
                <div className="customers-table-scroll overflow-x-auto">
                  <table className="customers-table customers-overview-table w-full min-w-[900px] table-fixed text-left text-xs text-slate-600 md:min-w-[980px]">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-[10px] uppercase tracking-[0.08em] text-slate-100/85 sm:text-[11px] sm:tracking-[0.16em]">
                      <tr>
                        <th className="sticky left-0 z-20 w-[20%] min-w-[11rem] whitespace-nowrap bg-slate-900 px-3 py-3 sm:px-4">{t("admin.customers.overview.table.customer")}</th>
                        <th className="w-[14%] min-w-[7rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.phone")}</th>
                        <th className="w-[23%] min-w-[10.5rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.address")}</th>
                        <th className="w-[22%] min-w-[10rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.properties")}</th>
                        <th className="w-[7%] min-w-[5.4rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.jobs")}</th>
                        <th className="w-[7%] min-w-[5.4rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.invoices")}</th>
                        <th className="w-[7%] min-w-[6rem] whitespace-nowrap px-3 py-3 sm:px-4">{t("admin.customers.overview.table.status")}</th>
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
                            <td className="sticky left-0 z-10 min-w-[13.5rem] bg-white px-4 py-3.5 group-hover:bg-sky-50/45">
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
            </>
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
                onClick={() =>
                  pushFilters({ page: Math.max(1, pagination.page - 1) })
                }
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

      {kpiCards}
    </section>
  );
}
