"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { getAssetUrl } from "@/lib/assets";
import { formatInBusinessTimeZone } from "@/lib/timezone";

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  theme: string;
  total: number;
  createdAt: string;
  jobLabel: string | null;
  pdfUrl: string | null;
};

type CustomerInvoicesTableProps = {
  rows: InvoiceRow[];
};

const PAGE_SIZE = 8;
const STATUS_ORDER = ["DRAFT", "SENT", "PAID", "OVERDUE"] as const;
const THEME_ORDER = ["STANDARD", "SPECIAL", "ESTIMATE"] as const;
type SortKey =
  | "date_desc"
  | "date_asc"
  | "total_desc"
  | "total_asc"
  | "number_asc"
  | "number_desc";

export default function CustomerInvoicesTable({ rows }: CustomerInvoicesTableProps) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [themeFilter, setThemeFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const allLabel = locale === "es" ? "Todos" : "All";
  const sortDateDescLabel =
    locale === "es"
      ? `${t("admin.invoices.list.table.date")} (reciente)`
      : `${t("admin.invoices.list.table.date")} (newest)`;
  const sortDateAscLabel =
    locale === "es"
      ? `${t("admin.invoices.list.table.date")} (antiguo)`
      : `${t("admin.invoices.list.table.date")} (oldest)`;
  const sortTotalDescLabel =
    locale === "es"
      ? `${t("admin.invoices.list.table.total")} (mayor)`
      : `${t("admin.invoices.list.table.total")} (high)`;
  const sortTotalAscLabel =
    locale === "es"
      ? `${t("admin.invoices.list.table.total")} (menor)`
      : `${t("admin.invoices.list.table.total")} (low)`;

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.status).filter(Boolean))).sort((a, b) => {
        const aIndex = STATUS_ORDER.indexOf(a as (typeof STATUS_ORDER)[number]);
        const bIndex = STATUS_ORDER.indexOf(b as (typeof STATUS_ORDER)[number]);
        if (aIndex === -1 && bIndex === -1) {
          return a.localeCompare(b);
        }
        if (aIndex === -1) {
          return 1;
        }
        if (bIndex === -1) {
          return -1;
        }
        return aIndex - bIndex;
      }),
    [rows]
  );
  const themeOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.theme).filter(Boolean))).sort((a, b) => {
        const aIndex = THEME_ORDER.indexOf(a as (typeof THEME_ORDER)[number]);
        const bIndex = THEME_ORDER.indexOf(b as (typeof THEME_ORDER)[number]);
        if (aIndex === -1 && bIndex === -1) {
          return a.localeCompare(b);
        }
        if (aIndex === -1) {
          return 1;
        }
        if (bIndex === -1) {
          return -1;
        }
        return aIndex - bIndex;
      }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    return rows.filter((invoice) => {
      if (statusFilter !== "ALL" && invoice.status !== statusFilter) {
        return false;
      }
      if (themeFilter !== "ALL" && invoice.theme !== themeFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const themeLabel =
        invoice.theme === "SPECIAL"
          ? t("admin.invoices.theme.special")
          : invoice.theme === "ESTIMATE"
            ? t("admin.invoices.theme.estimate")
            : t("admin.invoices.theme.standard");
      const statusLabel = t(`admin.invoices.status.${invoice.status.toLowerCase()}`);
      const haystack = [
        invoice.number,
        invoice.status,
        statusLabel,
        invoice.theme,
        themeLabel,
        invoice.jobLabel ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [rows, search, statusFilter, themeFilter, t]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      switch (sortKey) {
        case "date_asc":
          return aDate - bDate;
        case "date_desc":
          return bDate - aDate;
        case "total_asc":
          return a.total - b.total;
        case "total_desc":
          return b.total - a.total;
        case "number_desc":
          return b.number.localeCompare(a.number);
        case "number_asc":
        default:
          return a.number.localeCompare(b.number);
      }
    });
    return list;
  }, [filteredRows, sortKey]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, themeFilter, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, sortedRows]);
  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "ALL" ||
    themeFilter !== "ALL" ||
    sortKey !== "date_desc";
  const emptyMessage = hasActiveFilters
    ? locale === "es"
      ? "No hay facturas que coincidan con los filtros activos."
      : "No invoices match the active filters."
    : t("admin.invoices.list.empty");

  return (
    <section className="customers-panel ui-panel flex h-full min-w-0 flex-col overflow-hidden p-4 sm:p-6 lg:min-h-[440px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.invoices.title")}</h2>
          <p className="text-xs text-slate-500">
            {t("admin.invoices.list.showing", {
              count: sortedRows.length,
              total: rows.length,
            })}
          </p>
        </div>
        <span className="app-chip px-3 py-1 text-xs" data-tone="info">
          {sortedRows.length}
        </span>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px] lg:items-center">
          <label className="ui-search flex items-center gap-2 px-3 py-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="ui-search-icon h-4 w-4"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 20l-3-3" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("admin.invoices.filters.invoiceNumberPlaceholder")}
              className="ui-search-input w-full"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="ui-select w-full px-3 py-2 text-xs"
          >
            <option value="ALL">
              {t("admin.invoices.list.table.status")}: {allLabel}
            </option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {t(`admin.invoices.status.${status.toLowerCase()}`)}
              </option>
            ))}
          </select>

          <select
            value={themeFilter}
            onChange={(event) => setThemeFilter(event.target.value)}
            className="ui-select w-full px-3 py-2 text-xs"
          >
            <option value="ALL">
              {t("admin.invoices.list.theme")}: {allLabel}
            </option>
            {themeOptions.map((theme) => (
              <option key={theme} value={theme}>
                {theme === "SPECIAL"
                  ? t("admin.invoices.theme.special")
                  : theme === "ESTIMATE"
                    ? t("admin.invoices.theme.estimate")
                    : t("admin.invoices.theme.standard")}
              </option>
            ))}
          </select>

          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="ui-select w-full px-3 py-2 text-xs"
          >
            <option value="date_desc">{sortDateDescLabel}</option>
            <option value="date_asc">{sortDateAscLabel}</option>
            <option value="total_desc">{sortTotalDescLabel}</option>
            <option value="total_asc">{sortTotalAscLabel}</option>
            <option value="number_asc">{t("admin.invoices.list.table.invoice")} A-Z</option>
            <option value="number_desc">{t("admin.invoices.list.table.invoice")} Z-A</option>
          </select>
        </div>

        {hasActiveFilters ? (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setThemeFilter("ALL");
                setSortKey("date_desc");
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              {t("admin.invoices.filters.reset")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="customers-table-shell ui-table-shell mt-4 min-h-0 flex-1 overflow-hidden">
        <div className="customers-table-scroll h-full overflow-auto">
          <table className="customers-table customer-invoices-table w-full text-left text-xs text-slate-600">
            <thead className="sticky top-0 z-10 border-b border-slate-800/40 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-[11px] uppercase tracking-[0.16em] text-slate-100/85">
              <tr>
                <th className="w-[18%] px-2 py-2 sm:px-2.5 sm:py-2.5">{t("admin.invoices.list.table.invoice")}</th>
                <th className="w-[10%] px-2 py-2 sm:px-2.5 sm:py-2.5">{t("admin.invoices.list.table.status")}</th>
                <th className="w-[9%] px-2 py-2 sm:px-2.5 sm:py-2.5">{t("admin.invoices.list.theme")}</th>
                <th className="w-[27%] px-2 py-2 sm:px-2.5 sm:py-2.5">{t("admin.invoices.list.job")}</th>
                <th className="w-[10%] px-2 py-2 sm:px-2.5 sm:py-2.5">{t("admin.invoices.list.table.date")}</th>
                <th className="w-[10%] px-2 py-2 text-right sm:px-2.5 sm:py-2.5">{t("admin.invoices.list.table.total")}</th>
                <th className="w-[16%] px-2 py-2 text-right sm:px-2.5 sm:py-2.5">{t("admin.invoices.list.table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pagedRows.map((invoice) => {
                  const statusLabel = t(
                    `admin.invoices.status.${invoice.status.toLowerCase()}`
                  );
                  const canEdit = invoice.status === "DRAFT";
                  const themeLabel =
                    invoice.theme === "SPECIAL"
                      ? t("admin.invoices.theme.special")
                      : invoice.theme === "ESTIMATE"
                        ? t("admin.invoices.theme.estimate")
                        : t("admin.invoices.theme.standard");

                  return (
                    <tr key={invoice.id} className="bg-white transition hover:bg-sky-50/40">
                      <td className="px-2 py-2 font-semibold text-slate-900 sm:px-2.5 sm:py-2.5">
                        <p className="max-w-[8.75rem] truncate" title={invoice.number}>
                          {invoice.number}
                        </p>
                      </td>
                      <td className="px-2 py-2 sm:px-2.5 sm:py-2.5">{statusLabel}</td>
                      <td className="px-2 py-2 sm:px-2.5 sm:py-2.5">{themeLabel}</td>
                      <td className="px-2 py-2 text-[11px] text-slate-500 sm:px-2.5 sm:py-2.5">
                        <p
                          className="max-w-[12rem] truncate lg:max-w-[14rem]"
                          title={invoice.jobLabel ?? t("admin.invoices.list.noJob")}
                        >
                          {invoice.jobLabel ?? t("admin.invoices.list.noJob")}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-[11px] text-slate-500 sm:px-2.5 sm:py-2.5">
                        {formatInBusinessTimeZone(invoice.createdAt, locale, {
                          dateStyle: "short",
                        })}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-slate-900 sm:px-2.5 sm:py-2.5">
                        ${invoice.total.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 sm:px-2.5 sm:py-2.5">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {invoice.pdfUrl ? (
                            <a
                              href={getAssetUrl(invoice.pdfUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="ui-button-ghost px-2 py-1 text-[11px] font-semibold"
                            >
                              {t("admin.invoices.list.viewPdf")}
                            </a>
                          ) : null}
                          {canEdit ? (
                            <a
                              href={`/admin/invoices/${invoice.id}`}
                              className="ui-button-ghost px-2 py-1 text-[11px] font-semibold"
                            >
                              {t("common.actions.edit")}
                            </a>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
                              {t("admin.invoices.list.locked")}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sortedRows.length > 0 ? (
        <div className="sticky bottom-0 z-[1] mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white pt-3 text-xs text-slate-500">
          <span>
            {`${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(
              currentPage * PAGE_SIZE,
              sortedRows.length
            )} / ${sortedRows.length}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage <= 1}
              className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 disabled:opacity-50"
            >
              {t("admin.invoices.list.prev")}
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
              {t("admin.invoices.list.next")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

