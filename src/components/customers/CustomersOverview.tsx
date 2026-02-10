"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
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
  const { t } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState(filters.query);
  const [statusFilter, setStatusFilter] = useState(filters.status);
  const [sortKey, setSortKey] = useState<"name" | "jobs" | "properties">(
    filters.sort as "name" | "jobs" | "properties"
  );

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

  return (
    <section className="space-y-6">
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

      <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              {t("admin.customers.overview.actions.new")}
            </button>
          ) : createTargetId ? (
            <label
              htmlFor={createTargetId}
              className="app-button-primary cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              {t("admin.customers.overview.actions.new")}
            </label>
          ) : null}
        </div>

        <div className="ui-filter-bar mt-4 flex flex-wrap items-center gap-2 px-3 py-3">
          <label className="ui-search flex flex-1 items-center gap-2 px-3 py-2 text-xs">
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
            className="ui-select px-3 py-2 text-xs"
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
            className="ui-select px-3 py-2 text-xs"
          >
            <option value="name">{t("admin.customers.overview.sort.name")}</option>
            <option value="jobs">{t("admin.customers.overview.sort.jobs")}</option>
            <option value="properties">
              {t("admin.customers.overview.sort.properties")}
            </option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-xs text-slate-600">
            <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              <tr className="border-b border-slate-100">
                <th className="pb-3">{t("admin.customers.overview.table.customer")}</th>
                <th className="pb-3">{t("admin.customers.overview.table.status")}</th>
                <th className="pb-3">{t("admin.customers.overview.table.properties")}</th>
                <th className="pb-3">{t("admin.customers.overview.table.jobs")}</th>
                <th className="pb-3">{t("admin.customers.overview.table.invoices")}</th>
                <th className="pb-3 text-right">{t("admin.customers.overview.table.action")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    {t("admin.customers.overview.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-100">
                    <td className="py-3">
                      <p className="font-semibold text-slate-900">
                        {customer.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {customer.email}
                      </p>
                    </td>
                    <td className="py-3">
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
                    <td className="py-3 text-[11px] text-slate-500">
                      {customer.properties}
                    </td>
                    <td className="py-3 text-[11px] text-slate-500">
                      {customer.jobs}
                    </td>
                    <td className="py-3 text-[11px] text-slate-500">
                      {customer.invoices}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                      >
                        {t("admin.customers.overview.actions.viewProfile")}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
