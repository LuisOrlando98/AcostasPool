"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useI18n } from "@/i18n/client";
import { formatUsPhone } from "@/lib/phones";

type TechnicianRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  colorHex?: string | null;
  pending: number;
  completed: number;
  todayCount: number;
  lastActivity?: string | null;
};

type Props = {
  rows: TechnicianRow[];
  deleteTechnicianAction: (formData: FormData) => Promise<void>;
};

function DeleteTechnicianButton({
  idleLabel,
  pendingLabel,
  className,
}: {
  idleLabel: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

function getInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0] ?? "")
    .join("")
    .toUpperCase();

  return initials || "T";
}

export default function TechniciansOverview({ rows, deleteTechnicianAction }: Props) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [sortKey, setSortKey] = useState<"pending" | "completed" | "name">("pending");

  const clearFiltersLabel = locale === "es" ? "Limpiar filtros" : "Clear filters";
  const deletingLabel = locale === "es" ? "Eliminando..." : "Deleting...";
  const confirmDeleteMessage =
    locale === "es"
      ? "Se eliminara la cuenta del tecnico y se desasignaran sus trabajos. Deseas continuar?"
      : "This will delete the technician account and unassign their jobs. Do you want to continue?";

  const totals = useMemo(() => {
    const active = rows.filter((row) => row.isActive).length;
    return {
      total: rows.length,
      active,
      inactive: rows.length - active,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "ACTIVE" && !row.isActive) {
        return false;
      }
      if (statusFilter === "INACTIVE" && row.isActive) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      const haystack = [row.name, row.email, row.phone ?? ""].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [rows, query, statusFilter]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      if (sortKey === "name") {
        return a.name.localeCompare(b.name);
      }
      const delta = (b[sortKey] ?? 0) - (a[sortKey] ?? 0);
      return delta !== 0 ? delta : a.name.localeCompare(b.name);
    });
    return list;
  }, [filteredRows, sortKey]);

  const hasActiveFilters = query.trim().length > 0 || statusFilter !== "ALL" || sortKey !== "pending";

  const formatLastActivity = (value?: string | null) => {
    if (!value) {
      return t("admin.technicians.overview.activity.none");
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return t("admin.technicians.overview.activity.none");
    }
    return date.toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.technicians.overview.title")}</h2>
          <p className="text-sm text-slate-500">
            {t("admin.technicians.overview.results", {
              count: filteredRows.length,
            })}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <div className="ui-search flex w-full items-center gap-2 px-3 py-2">
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
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("admin.technicians.overview.placeholders.search")}
              className="ui-search-input w-full"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[auto_auto_1fr] md:items-center">
            <div className="ui-segment grid w-full grid-cols-3 items-center gap-1 md:w-auto">
              {(
                [
                  {
                    id: "ALL",
                    label: t("admin.technicians.overview.filters.all"),
                    count: totals.total,
                  },
                  {
                    id: "ACTIVE",
                    label: t("common.status.active"),
                    count: totals.active,
                  },
                  {
                    id: "INACTIVE",
                    label: t("admin.technicians.overview.filters.inactive"),
                    count: totals.inactive,
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id)}
                  className={`ui-segment-item flex items-center justify-center gap-1 px-2 py-2 text-[11px] sm:text-xs ${
                    statusFilter === item.id ? "is-active" : ""
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>

            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as "pending" | "completed" | "name")}
              className="ui-select w-full px-3 py-2 text-xs md:w-auto"
            >
              <option value="pending">{t("admin.technicians.overview.sort.pending")}</option>
              <option value="completed">{t("admin.technicians.overview.sort.completed")}</option>
              <option value="name">{t("admin.technicians.overview.sort.name")}</option>
            </select>

            <div className="grid grid-cols-2 gap-2 md:ml-auto md:flex md:items-center">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("ALL");
                    setSortKey("pending");
                  }}
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  {clearFiltersLabel}
                </button>
              ) : null}
              <label
                htmlFor="new-tech"
                className={`app-button-primary cursor-pointer px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] ${
                  hasActiveFilters ? "" : "col-span-2"
                }`}
              >
                {t("admin.technicians.overview.actions.new")}
              </label>
            </div>
          </div>
        </div>

        <div className="mt-5">
          {sortedRows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 px-4 py-8 text-sm text-slate-500">
              {t("admin.technicians.overview.empty")}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {sortedRows.map((row) => (
                  <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white shadow-sm"
                          style={{
                            backgroundColor: row.colorHex || "#e2e8f0",
                            color: row.colorHex ? "#ffffff" : "#0f172a",
                          }}
                        >
                          <span className="text-xs font-semibold">{getInitials(row.name)}</span>
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                          <p className="truncate text-[11px] text-slate-500">{row.email}</p>
                          {row.phone ? (
                            <p className="text-[11px] text-slate-500">{formatUsPhone(row.phone) ?? row.phone}</p>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          row.isActive
                            ? "border-teal-200 bg-teal-50 text-teal-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {row.isActive ? t("common.status.active") : t("admin.technicians.overview.filters.inactive")}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          {t("admin.technicians.overview.table.todayRoute")}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-900">
                          {row.todayCount > 0
                            ? t("admin.technicians.overview.table.todayCount", { count: row.todayCount })
                            : t("admin.technicians.overview.table.noRoute")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-2 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-indigo-600">
                          {t("admin.technicians.overview.table.pending")}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-indigo-800">{row.pending}</p>
                      </div>
                      <div className="rounded-xl border border-sky-200 bg-sky-50 px-2 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-sky-600">
                          {t("admin.technicians.overview.table.completed")}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-sky-800">{row.completed}</p>
                      </div>
                    </div>

                    <p className="mt-3 text-[11px] text-slate-500">
                      {t("admin.technicians.overview.table.lastActivity")}: {formatLastActivity(row.lastActivity)}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link
                        href={`/admin/routes?tech=${row.id}`}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        {t("admin.technicians.overview.actions.viewRoute")}
                      </Link>
                      <Link
                        href={`/admin/technicians/${row.id}`}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        {t("admin.technicians.overview.actions.viewProfile")}
                      </Link>
                    </div>

                    <form
                      action={deleteTechnicianAction}
                      className="mt-2"
                      onSubmit={(event) => {
                        if (!window.confirm(confirmDeleteMessage)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="technicianId" value={row.id} />
                      <DeleteTechnicianButton
                        idleLabel={t("common.actions.delete")}
                        pendingLabel={deletingLabel}
                        className="inline-flex w-full items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </form>
                  </article>
                ))}
              </div>

              <div className="ui-table-shell hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-[960px] w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">{t("admin.technicians.overview.table.technician")}</th>
                        <th className="px-4 py-3">{t("admin.technicians.overview.table.status")}</th>
                        <th className="px-4 py-3">{t("admin.technicians.overview.table.todayRoute")}</th>
                        <th className="px-4 py-3">{t("admin.technicians.overview.table.pending")}</th>
                        <th className="px-4 py-3">{t("admin.technicians.overview.table.completed")}</th>
                        <th className="px-4 py-3">{t("admin.technicians.overview.table.lastActivity")}</th>
                        <th className="px-4 py-3 text-right">{t("admin.technicians.overview.table.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedRows.map((row) => (
                        <tr key={row.id} className="group bg-white hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span
                                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white shadow-sm"
                                style={{
                                  backgroundColor: row.colorHex || "#e2e8f0",
                                  color: row.colorHex ? "#ffffff" : "#0f172a",
                                }}
                              >
                                <span className="text-xs font-semibold">{getInitials(row.name)}</span>
                              </span>
                              <div>
                                <p className="font-semibold text-slate-900">{row.name}</p>
                                <p className="text-[11px] text-slate-500">{row.email}</p>
                                {row.phone ? (
                                  <p className="text-[10px] text-slate-400">
                                    {formatUsPhone(row.phone) ?? row.phone}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${
                                row.isActive
                                  ? "border-teal-200 bg-teal-50 text-teal-700"
                                  : "border-slate-200 bg-slate-50 text-slate-500"
                              }`}
                            >
                              {row.isActive
                                ? t("common.status.active")
                                : t("admin.technicians.overview.filters.inactive")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {row.todayCount > 0 ? (
                              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
                                {t("admin.technicians.overview.table.todayCount", {
                                  count: row.todayCount,
                                })}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-500">
                                {t("admin.technicians.overview.table.noRoute")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                              {row.pending}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
                              {row.completed}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-500">
                            {formatLastActivity(row.lastActivity)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/admin/routes?tech=${row.id}`}
                                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                              >
                                {t("admin.technicians.overview.actions.viewRoute")}
                              </Link>
                              <Link
                                href={`/admin/technicians/${row.id}`}
                                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                              >
                                {t("admin.technicians.overview.actions.viewProfile")}
                              </Link>
                              <form
                                action={deleteTechnicianAction}
                                onSubmit={(event) => {
                                  if (!window.confirm(confirmDeleteMessage)) {
                                    event.preventDefault();
                                  }
                                }}
                              >
                                <input type="hidden" name="technicianId" value={row.id} />
                                <DeleteTechnicianButton
                                  idleLabel={t("common.actions.delete")}
                                  pendingLabel={deletingLabel}
                                  className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                                />
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
