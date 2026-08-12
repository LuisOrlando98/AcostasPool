"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/i18n/client";
import { buildPageItems } from "@/lib/ui/pagination";
import { formatInBusinessTimeZone } from "@/lib/timezone";
import { getJobStatusLabel } from "@/lib/constants";

type RequestRow = {
  id: string;
  customerId: string;
  customerName: string;
  propertyLabel: string;
  status: string;
  priority: string;
  requestCategory: string | null;
  requestIssue: string | null;
  notes: string | null;
  requestedAt: string;
  technicianId: string | null;
  technicianName: string | null;
};

type TechnicianOption = { id: string; name: string };

type Filter = "UNASSIGNED" | "ASSIGNED" | "RESOLVED" | "ALL";

const PAGE_SIZE = 12;

export default function RequestsTable({
  rows,
  technicians,
  assignAction,
}: {
  rows: RequestRow[];
  technicians: TechnicianOption[];
  assignAction: (formData: FormData) => Promise<{ error?: string } | undefined>;
}) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<Filter>("UNASSIGNED");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [assigning, setAssigning] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryLabel = (category: string | null) =>
    category ? t(`client.request.categories.${category}`) : null;
  const issueLabel = (issue: string | null) =>
    issue ? t(`client.request.issues.${issue}`) : null;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter =
        filter === "ALL"
          ? true
          : filter === "RESOLVED"
            ? row.status === "COMPLETED"
            : filter === "ASSIGNED"
              ? Boolean(row.technicianId) && row.status !== "COMPLETED"
              : !row.technicianId && row.status !== "COMPLETED";
      if (!matchesFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        row.customerName,
        row.propertyLabel,
        row.notes ?? "",
        row.requestCategory ? t(`client.request.categories.${row.requestCategory}`) : "",
        row.requestIssue ? t(`client.request.issues.${row.requestIssue}`) : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, filter, search, t]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => buildPageItems(currentPage, totalPages), [currentPage, totalPages]);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const counts = {
    UNASSIGNED: rows.filter((row) => !row.technicianId && row.status !== "COMPLETED").length,
    ASSIGNED: rows.filter((row) => Boolean(row.technicianId) && row.status !== "COMPLETED").length,
    RESOLVED: rows.filter((row) => row.status === "COMPLETED").length,
    ALL: rows.length,
  };

  const handleAssign = (jobId: string) => {
    const technicianId = assigning[jobId];
    if (!technicianId) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("jobId", jobId);
    formData.set("technicianId", technicianId);
    startTransition(async () => {
      const result = await assignAction(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <section className="app-card p-6 shadow-contrast">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.requests.table.title")}</h2>
          <p className="text-sm text-slate-500">
            {t("admin.requests.table.showing", { count: filteredRows.length, total: rows.length })}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={t("admin.requests.table.searchPlaceholder")}
          className="app-input min-w-[14rem] flex-1 px-4 py-2.5 text-sm"
        />
        <div className="ui-segment">
          {(["UNASSIGNED", "ASSIGNED", "RESOLVED", "ALL"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
              className={`ui-segment-item ${filter === value ? "is-active" : ""}`}
            >
              {t(`admin.requests.filters.${value}`)} ({counts[value]})
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {paginatedRows.length === 0 ? (
          <p className="text-sm text-slate-500">{t("admin.requests.table.empty")}</p>
        ) : (
          paginatedRows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {categoryLabel(row.requestCategory) ? (
                      <Badge label={categoryLabel(row.requestCategory) as string} tone="info" />
                    ) : null}
                    {row.priority === "URGENT" ? (
                      <Badge label={t("client.request.urgentBadge")} tone="danger" />
                    ) : null}
                    <Badge label={getJobStatusLabel(row.status, t)} tone="neutral" />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{row.customerName}</p>
                  <p className="text-xs text-slate-500">
                    {row.propertyLabel}
                    {issueLabel(row.requestIssue) ? ` - ${issueLabel(row.requestIssue)}` : ""}
                  </p>
                  {row.notes ? (
                    <p className="mt-2 max-w-2xl whitespace-pre-line text-xs text-slate-500">
                      {row.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <p className="text-xs text-slate-400">
                    {formatInBusinessTimeZone(new Date(row.requestedAt), locale, { dateStyle: "medium" })}
                  </p>
                  <Link
                    href={`/admin/routes?highlight=${row.id}`}
                    className="app-button-ghost px-3 py-1.5 text-xs font-semibold"
                  >
                    {t("admin.requests.table.viewInCalendar")}
                  </Link>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-200 pt-3">
                {row.technicianName ? (
                  <p className="text-xs font-semibold text-emerald-700">
                    {t("admin.requests.table.assignedTo", { name: row.technicianName })}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={assigning[row.id] ?? ""}
                      onChange={(event) =>
                        setAssigning((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                      className="app-input bg-white px-3 py-2 text-xs"
                    >
                      <option value="">{t("admin.requests.table.selectTechnician")}</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAssign(row.id)}
                      disabled={!assigning[row.id] || isPending}
                      className="app-button-secondary px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t("admin.requests.table.assign")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>{t("admin.requests.table.page", { page: currentPage, total: totalPages })}</span>
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
