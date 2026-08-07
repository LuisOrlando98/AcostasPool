"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/i18n/client";
import { buildPageItems } from "@/lib/ui/pagination";
import { formatInBusinessTimeZone } from "@/lib/timezone";
import { getAssetUrl } from "@/lib/assets";

type Category = "SIGNED" | "PENDING" | "STALE" | "NONE";

type ContractRow = {
  customerId: string;
  customerName: string;
  status: string;
  category: Category;
  periodMonth: string | null;
  sentAt: string | null;
  signedAt: string | null;
  pdfUrl: string | null;
};

type FilterState = {
  search: string;
  category: "ALL" | Category;
};

const DEFAULT_FILTERS: FilterState = { search: "", category: "ALL" };

const PAGE_SIZE = 12;

const CATEGORY_TONE: Record<Category, "success" | "info" | "danger" | "warning"> = {
  SIGNED: "success",
  PENDING: "info",
  STALE: "danger",
  NONE: "warning",
};

export default function ContractsHealthTable({ rows }: { rows: ContractRow[] }) {
  const { t, locale } = useI18n();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const categoryLabel = (category: Category) => t(`admin.reports.contracts.category.${category}`);
  const statusLabel = (status: string) =>
    status === "NONE"
      ? t("admin.reports.contracts.status.NONE")
      : t(`admin.customers.detail.contract.status.${status}`);

  const filteredRows = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (filters.category !== "ALL" && row.category !== filters.category) {
          return false;
        }
        if (!query) {
          return true;
        }
        return row.customerName.toLowerCase().includes(query);
      })
      .sort((left, right) => left.customerName.localeCompare(right.customerName));
  }, [filters, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => buildPageItems(currentPage, totalPages), [currentPage, totalPages]);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const activeFilterCount = [
    filters.search.trim().length > 0,
    filters.category !== "ALL",
  ].filter(Boolean).length;

  return (
    <section className="app-card p-6 shadow-contrast">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.reports.contracts.table.title")}</h2>
          <p className="text-sm text-slate-500">
            {t("admin.reports.contracts.table.showing", {
              count: filteredRows.length,
              total: rows.length,
            })}
          </p>
        </div>
        {activeFilterCount > 0 ? (
          <span className="app-chip px-3 py-1 text-xs" data-tone="info">
            {t("admin.reports.contracts.table.activeCount", { count: activeFilterCount })}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={filters.search}
          onChange={(event) => {
            setFilters((current) => ({ ...current, search: event.target.value }));
            setPage(1);
          }}
          placeholder={t("admin.reports.contracts.table.searchPlaceholder")}
          className="app-input min-w-[14rem] flex-1 px-4 py-2.5 text-sm"
        />
        <div className="ui-segment">
          {(["ALL", "SIGNED", "PENDING", "STALE", "NONE"] as const).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setFilters((current) => ({ ...current, category }));
                setPage(1);
              }}
              className={`ui-segment-item ${filters.category === category ? "is-active" : ""}`}
            >
              {category === "ALL" ? t("common.labels.all") : categoryLabel(category)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-[11px] uppercase tracking-[0.14em] text-slate-100/85">
              <tr>
                <th className="px-4 py-3">{t("admin.reports.contracts.table.customer")}</th>
                <th className="px-4 py-3">{t("admin.reports.contracts.table.status")}</th>
                <th className="px-4 py-3">{t("admin.reports.contracts.table.period")}</th>
                <th className="px-4 py-3">{t("admin.reports.contracts.table.sentAt")}</th>
                <th className="px-4 py-3">{t("admin.reports.contracts.table.signedAt")}</th>
                <th className="px-4 py-3 text-right">{t("admin.reports.contracts.table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    {t("admin.reports.contracts.table.empty")}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr key={row.customerId} className="transition hover:bg-sky-50/40">
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{row.customerName}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge label={statusLabel(row.status)} tone={CATEGORY_TONE[row.category]} />
                        {row.category === "STALE" ? (
                          <Badge label={t("admin.reports.contracts.category.STALE")} tone="danger" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {row.periodMonth
                        ? formatInBusinessTimeZone(new Date(row.periodMonth), locale, {
                            month: "long",
                            year: "numeric",
                          })
                        : t("common.labels.notAvailable")}
                    </td>
                    <td className="px-4 py-3.5">
                      {row.sentAt
                        ? formatInBusinessTimeZone(new Date(row.sentAt), locale, { dateStyle: "short" })
                        : t("common.labels.notAvailable")}
                    </td>
                    <td className="px-4 py-3.5">
                      {row.signedAt
                        ? formatInBusinessTimeZone(new Date(row.signedAt), locale, { dateStyle: "short" })
                        : t("common.labels.notAvailable")}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {row.pdfUrl ? (
                          <a
                            href={getAssetUrl(row.pdfUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-slate-600 underline"
                          >
                            {t("admin.invoices.list.viewPdf")}
                          </a>
                        ) : null}
                        <Link
                          href={`/admin/customers/${row.customerId}`}
                          className="ui-button-ghost px-3 py-1.5 text-xs font-semibold"
                        >
                          {t("admin.reports.propertyHealth.table.viewCustomer")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {t("admin.reports.contracts.table.page", { page: currentPage, total: totalPages })}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className={`rounded-full border px-3 py-1.5 font-semibold ${
                currentPage === 1
                  ? "border-slate-100 text-slate-300"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {t("admin.invoices.servicePayment.pagination.prev")}
            </button>
            {pageItems.map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={`rounded-full border px-3 py-1.5 font-semibold ${
                    item === currentPage
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  aria-current={item === currentPage ? "page" : undefined}
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
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage === totalPages}
              className={`rounded-full border px-3 py-1.5 font-semibold ${
                currentPage === totalPages
                  ? "border-slate-100 text-slate-300"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {t("admin.invoices.servicePayment.pagination.next")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
