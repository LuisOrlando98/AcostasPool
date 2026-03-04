"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { getAssetUrl } from "@/lib/assets";

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

export default function CustomerInvoicesTable({ rows }: CustomerInvoicesTableProps) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [currentPage, rows]);

  return (
    <section className="ui-panel h-full min-w-0 overflow-hidden p-6 lg:min-h-[440px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.invoices.title")}</h2>
          <p className="text-xs text-slate-500">
            {t("admin.invoices.list.total", { count: rows.length })}
          </p>
        </div>
        <span className="app-chip px-3 py-1 text-xs" data-tone="info">
          {rows.length}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[860px] w-full text-left text-xs text-slate-600">
          <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            <tr className="border-b border-slate-100">
              <th className="pb-3">Invoice</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">{t("admin.invoices.list.theme")}</th>
              <th className="pb-3">{t("admin.invoices.list.job")}</th>
              <th className="pb-3">Date</th>
              <th className="pb-3 text-right">Total</th>
              <th className="pb-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                  {t("admin.invoices.list.empty")}
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
                  <tr key={invoice.id} className="border-b border-slate-100">
                    <td className="py-3 font-semibold text-slate-900">{invoice.number}</td>
                    <td className="py-3">{statusLabel}</td>
                    <td className="py-3">{themeLabel}</td>
                    <td className="py-3 text-[11px] text-slate-500">
                      {invoice.jobLabel ?? t("admin.invoices.list.noJob")}
                    </td>
                    <td className="py-3 text-[11px] text-slate-500">
                      {new Date(invoice.createdAt).toLocaleDateString(locale)}
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-900">
                      ${invoice.total.toFixed(2)}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {invoice.pdfUrl ? (
                          <a
                            href={getAssetUrl(invoice.pdfUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="ui-button-ghost px-3 py-1 text-[11px] font-semibold"
                          >
                            {t("admin.invoices.list.viewPdf")}
                          </a>
                        ) : null}
                        {canEdit ? (
                          <a
                            href={`/admin/invoices/${invoice.id}`}
                            className="ui-button-ghost px-3 py-1 text-[11px] font-semibold"
                          >
                            {t("common.actions.edit")}
                          </a>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
                            Locked
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
  );
}
