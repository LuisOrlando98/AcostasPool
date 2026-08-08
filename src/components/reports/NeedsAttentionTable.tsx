"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/i18n/client";
import { buildPageItems } from "@/lib/ui/pagination";

type AttentionPropertyIssue = {
  propertyName: string;
  flag: "RED" | "YELLOW";
  issues: string[];
};

type AttentionRow = {
  customerId: string;
  customerName: string;
  score: number;
  propertyIssues: AttentionPropertyIssue[];
  contractIssue: "STALE" | "NONE" | null;
  pastDueMembershipCents: number | null;
  overdueInvoiceTotalCents: number;
  overdueInvoiceCount: number;
};

const PAGE_SIZE = 10;

export default function NeedsAttentionTable({
  rows,
  exportHref,
}: {
  rows: AttentionRow[];
  exportHref?: string;
}) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(cents / 100);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => row.customerName.toLowerCase().includes(query));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => buildPageItems(currentPage, totalPages), [currentPage, totalPages]);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  return (
    <section className="app-card p-6 shadow-contrast">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.reports.needsAttention.table.title")}</h2>
          <p className="text-sm text-slate-500">
            {t("admin.reports.needsAttention.table.showing", {
              count: filteredRows.length,
              total: rows.length,
            })}
          </p>
        </div>
        {exportHref ? (
          <a href={exportHref} className="app-button-secondary px-3 py-2 text-xs font-semibold">
            {t("admin.reports.exports.csv")}
          </a>
        ) : null}
      </div>

      <div className="mt-4">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={t("admin.reports.needsAttention.table.searchPlaceholder")}
          className="app-input w-full max-w-sm px-4 py-2.5 text-sm"
        />
      </div>

      <div className="mt-5 space-y-3">
        {paginatedRows.length === 0 ? (
          <p className="text-sm text-slate-500">{t("admin.reports.needsAttention.table.empty")}</p>
        ) : (
          paginatedRows.map((row) => (
            <div
              key={row.customerId}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold text-slate-900">{row.customerName}</p>
                <Link
                  href={`/admin/customers/${row.customerId}`}
                  className="app-button-ghost px-3 py-1.5 text-xs font-semibold"
                >
                  {t("admin.reports.propertyHealth.table.viewCustomer")}
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {row.propertyIssues.map((issue) => (
                  <span
                    key={issue.propertyName}
                    className="app-chip px-2.5 py-1 text-[11px]"
                    data-tone={issue.flag === "RED" ? "danger" : "warning"}
                  >
                    {issue.propertyName}: {issue.issues.join(", ")}
                  </span>
                ))}
                {row.contractIssue ? (
                  <Badge
                    label={t(`admin.reports.contracts.category.${row.contractIssue}`)}
                    tone={row.contractIssue === "STALE" ? "danger" : "warning"}
                  />
                ) : null}
                {row.pastDueMembershipCents ? (
                  <span className="app-chip px-2.5 py-1 text-[11px]" data-tone="danger">
                    {t("admin.reports.needsAttention.table.autopayFailed", {
                      amount: money(row.pastDueMembershipCents),
                    })}
                  </span>
                ) : null}
                {row.overdueInvoiceCount > 0 ? (
                  <span className="app-chip px-2.5 py-1 text-[11px]" data-tone="danger">
                    {t("admin.reports.needsAttention.table.overdueInvoices", {
                      count: row.overdueInvoiceCount,
                      amount: money(row.overdueInvoiceTotalCents),
                    })}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {t("admin.reports.propertyHealth.table.page", { page: currentPage, total: totalPages })}
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
