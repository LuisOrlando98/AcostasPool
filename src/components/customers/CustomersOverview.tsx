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

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="app-card p-5">
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
            {t("admin.customers.overview.cards.customers")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {summary.total}
          </p>
          <p className="text-xs text-slate-500">
            {t("admin.customers.overview.cards.total")}
          </p>
        </div>
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <p className="text-[11px] uppercase tracking-[0.35em] text-teal-700">
            {t("admin.customers.overview.cards.active")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-teal-900">
            {summary.active}
          </p>
          <p className="text-xs text-teal-700">
            {t("admin.customers.overview.cards.activeHint")}
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="text-[11px] uppercase tracking-[0.35em] text-indigo-700">
            {t("admin.customers.overview.cards.inactive")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-indigo-900">
            {summary.inactive}
          </p>
          <p className="text-xs text-indigo-700">
            {t("admin.customers.overview.cards.inactiveHint")}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <p className="text-[11px] uppercase tracking-[0.35em] text-sky-700">
            {t("admin.customers.overview.cards.properties")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-sky-900">
            {summary.properties}
          </p>
          <p className="text-xs text-sky-700">
            {t("admin.customers.overview.cards.propertiesHint")}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6">
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

        <div className="ui-filter-bar mt-4 grid gap-2 px-3 py-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
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
            className="ui-select w-full px-3 py-2 text-xs xl:w-auto"
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
            className="ui-select w-full px-3 py-2 text-xs xl:w-auto"
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
              <div className="space-y-3 md:hidden">
                {rows.map((customer) => {
                  const propertiesPreview = customer.propertyNames.join(", ");
                  return (
                    <article
                      key={customer.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/30"
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
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {customer.name}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {customer.email}
                          </p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            customer.status === "ACTIVE"
                              ? "border-teal-200 bg-teal-50 text-teal-700"
                              : "border-indigo-200 bg-indigo-50 text-indigo-700"
                          }`}
                        >
                          {customer.status === "ACTIVE"
                            ? t("common.status.active")
                            : t("common.status.inactive")}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                            {t("admin.customers.overview.table.phone")}
                          </p>
                          <p className="mt-1 text-xs text-slate-700">
                            {formatUsPhone(customer.phone) ??
                              customer.phone ??
                              t("common.labels.notAvailable")}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                            {t("admin.customers.overview.table.address")}
                          </p>
                          <p className="mt-1 text-xs text-slate-700">
                            {customer.address || t("common.labels.notAvailable")}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl border border-sky-200 bg-sky-50 px-2 py-2">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-sky-700">
                            {t("admin.customers.overview.table.properties")}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-sky-900">
                            {customer.properties}
                          </p>
                        </div>
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-2 py-2">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-indigo-700">
                            {t("admin.customers.overview.table.jobs")}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-indigo-900">
                            {customer.jobs}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-slate-600">
                            {t("admin.customers.overview.table.invoices")}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-900">
                            {customer.invoices}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                          {t("admin.customers.overview.table.properties")}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          {propertiesPreview || t("admin.routes.labels.noProperties")}
                        </p>
                      </div>

                      <div className="mt-3">
                        <p className="w-full rounded-full border border-slate-200 px-3 py-2 text-center text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900">
                          {t("admin.customers.overview.actions.viewProfile")}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="ui-table-shell hidden overflow-hidden md:block">
                <div className="overflow-x-auto xl:overflow-visible">
                  <table className="w-full min-w-[980px] text-left text-xs text-slate-600 xl:min-w-0">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">{t("admin.customers.overview.table.customer")}</th>
                        <th className="px-4 py-3">{t("admin.customers.overview.table.phone")}</th>
                        <th className="px-4 py-3">{t("admin.customers.overview.table.address")}</th>
                        <th className="px-4 py-3">{t("admin.customers.overview.table.properties")}</th>
                        <th className="px-4 py-3">{t("admin.customers.overview.table.jobs")}</th>
                        <th className="px-4 py-3">{t("admin.customers.overview.table.invoices")}</th>
                        <th className="px-4 py-3">{t("admin.customers.overview.table.status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((customer) => {
                        const propertiesPreview = customer.propertyNames.join(", ");
                        return (
                    <tr
                      key={customer.id}
                      className="cursor-pointer bg-white transition hover:bg-sky-50/45"
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
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {customer.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {customer.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        {formatUsPhone(customer.phone) ??
                          customer.phone ??
                          t("common.labels.notAvailable")}
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className="max-w-[18rem] truncate text-[11px] text-slate-600"
                          title={customer.address || ""}
                        >
                          {customer.address || t("common.labels.notAvailable")}
                        </p>
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {customer.jobs}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {customer.invoices}
                      </td>
                      <td className="px-4 py-3">
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
    </section>
  );
}
