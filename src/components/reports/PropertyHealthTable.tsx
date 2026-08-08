"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/i18n/client";
import { buildPageItems } from "@/lib/ui/pagination";
import { formatInBusinessTimeZone } from "@/lib/timezone";

type Flag = "RED" | "YELLOW" | "GREEN" | "UNSET";

type PropertyHealthRow = {
  propertyId: string;
  customerId: string;
  customerName: string;
  propertyName: string;
  propertyAddress: string;
  flag: Flag;
  issues: Array<{ key: string; label: string; statusLabel: string; severity: "BROKEN" | "BAD" }>;
  notes: string | null;
  updatedAt: string;
};

type FilterState = {
  search: string;
  flag: "ALL" | Flag;
  sort: "updated" | "severity" | "customer";
};

const DEFAULT_FILTERS: FilterState = {
  search: "",
  flag: "ALL",
  sort: "severity",
};

const PAGE_SIZE = 10;

const FLAG_DOT: Record<Flag, string> = {
  RED: "bg-rose-500",
  YELLOW: "bg-amber-400",
  GREEN: "bg-emerald-500",
  UNSET: "bg-slate-300",
};

const FLAG_TONE: Record<Flag, "danger" | "warning" | "success" | "neutral"> = {
  RED: "danger",
  YELLOW: "warning",
  GREEN: "success",
  UNSET: "neutral",
};

const FLAG_SEVERITY_ORDER: Record<Flag, number> = {
  RED: 0,
  YELLOW: 1,
  UNSET: 2,
  GREEN: 3,
};

export default function PropertyHealthTable({
  rows,
  exportHref,
}: {
  rows: PropertyHealthRow[];
  exportHref?: string;
}) {
  const { t, locale } = useI18n();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const flagLabel = (flag: Flag) => t(`admin.reports.propertyHealth.flags.${flag}`);

  const filteredRows = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (filters.flag !== "ALL" && row.flag !== filters.flag) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        row.customerName,
        row.propertyName,
        row.propertyAddress,
        row.notes ?? "",
        ...row.issues.map((issue) => issue.label),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    return next.sort((left, right) => {
      if (filters.sort === "customer") {
        return left.customerName.localeCompare(right.customerName);
      }
      if (filters.sort === "updated") {
        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      }
      const severityOrder = FLAG_SEVERITY_ORDER[left.flag] - FLAG_SEVERITY_ORDER[right.flag];
      if (severityOrder !== 0) {
        return severityOrder;
      }
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
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
    filters.flag !== "ALL",
    filters.sort !== DEFAULT_FILTERS.sort,
  ].filter(Boolean).length;

  return (
    <section className="app-card p-6 shadow-contrast">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.reports.propertyHealth.table.title")}</h2>
          <p className="text-sm text-slate-500">
            {t("admin.reports.propertyHealth.table.showing", {
              count: filteredRows.length,
              total: rows.length,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterCount > 0 ? (
            <span className="app-chip px-3 py-1 text-xs" data-tone="info">
              {t("admin.reports.propertyHealth.table.activeCount", { count: activeFilterCount })}
            </span>
          ) : null}
          {exportHref ? (
            <a href={exportHref} className="app-button-secondary px-3 py-2 text-xs font-semibold">
              {t("admin.reports.exports.csv")}
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={filters.search}
          onChange={(event) => {
            setFilters((current) => ({ ...current, search: event.target.value }));
            setPage(1);
          }}
          placeholder={t("admin.reports.propertyHealth.table.searchPlaceholder")}
          className="app-input min-w-[14rem] flex-1 px-4 py-2.5 text-sm"
        />
        <div className="ui-segment">
          {(["ALL", "RED", "YELLOW", "GREEN", "UNSET"] as const).map((flag) => (
            <button
              key={flag}
              type="button"
              onClick={() => {
                setFilters((current) => ({ ...current, flag }));
                setPage(1);
              }}
              className={`ui-segment-item ${filters.flag === flag ? "is-active" : ""}`}
            >
              {flag === "ALL" ? t("common.labels.all") : flagLabel(flag)}
            </button>
          ))}
        </div>
        <select
          value={filters.sort}
          onChange={(event) => {
            setFilters((current) => ({
              ...current,
              sort: event.target.value as FilterState["sort"],
            }));
            setPage(1);
          }}
          className="app-input bg-white px-3 py-2.5 text-sm"
        >
          <option value="severity">{t("admin.reports.propertyHealth.table.sort.severity")}</option>
          <option value="updated">{t("admin.reports.propertyHealth.table.sort.updated")}</option>
          <option value="customer">{t("admin.reports.propertyHealth.table.sort.customer")}</option>
        </select>
      </div>

      <div className="mt-5 space-y-3">
        {paginatedRows.length === 0 ? (
          <p className="text-sm text-slate-500">{t("admin.reports.propertyHealth.table.empty")}</p>
        ) : (
          paginatedRows.map((row) => (
            <div
              key={row.propertyId}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${FLAG_DOT[row.flag]}`} />
                  <div>
                    <p className="font-semibold text-slate-900">{row.customerName}</p>
                    <p className="text-xs text-slate-500">
                      {row.propertyName}
                      {row.propertyAddress && row.propertyAddress !== row.propertyName
                        ? ` - ${row.propertyAddress}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge label={flagLabel(row.flag)} tone={FLAG_TONE[row.flag]} />
                  <Link
                    href={`/admin/customers/${row.customerId}`}
                    className="app-button-ghost px-3 py-1.5 text-xs font-semibold"
                  >
                    {t("admin.reports.propertyHealth.table.viewCustomer")}
                  </Link>
                </div>
              </div>

              {row.issues.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.issues.map((issue) => (
                    <span
                      key={issue.key}
                      className="app-chip px-2.5 py-1 text-[11px]"
                      data-tone={issue.severity === "BROKEN" ? "danger" : "warning"}
                    >
                      {issue.label}: {issue.statusLabel}
                    </span>
                  ))}
                </div>
              ) : null}

              {row.notes?.trim() ? (
                <p className="mt-3 text-xs text-slate-500">{row.notes}</p>
              ) : null}

              <p className="mt-2 text-[11px] text-slate-400">
                {t("admin.reports.propertyHealth.table.updated", {
                  date: formatInBusinessTimeZone(new Date(row.updatedAt), locale, {
                    dateStyle: "medium",
                  }),
                })}
              </p>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {t("admin.reports.propertyHealth.table.page", {
              page: currentPage,
              total: totalPages,
            })}
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
