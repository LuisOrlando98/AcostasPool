"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
};

export default function TechniciansOverview({ rows }: Props) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");
  const [sortKey, setSortKey] = useState<"pending" | "completed" | "name">(
    "pending"
  );

  const totals = useMemo(() => {
    const active = rows.filter((row) => row.isActive).length;
    const pending = rows.reduce((sum, row) => sum + row.pending, 0);
    const completed = rows.reduce((sum, row) => sum + row.completed, 0);
    return {
      total: rows.length,
      active,
      inactive: rows.length - active,
      pending,
      completed,
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
      const haystack = [row.name, row.email, row.phone ?? ""]
        .join(" ")
        .toLowerCase();
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="app-card p-5">
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">
            {t("admin.technicians.overview.cards.technicians")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {totals.total}
          </p>
          <p className="text-xs text-slate-500">
            {t("admin.technicians.overview.cards.total")}
          </p>
        </div>
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.35em] text-teal-700">
            {t("admin.technicians.overview.cards.active")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-teal-900">
            {totals.active}
          </p>
          <p className="text-xs text-teal-700">
            {t("admin.technicians.overview.cards.activeHint")}
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.35em] text-indigo-700">
            {t("admin.technicians.overview.cards.pending")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-indigo-900">
            {totals.pending}
          </p>
          <p className="text-xs text-indigo-700">
            {t("admin.technicians.overview.cards.pendingHint")}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.35em] text-sky-700">
            {t("admin.technicians.overview.cards.completed")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-sky-900">
            {totals.completed}
          </p>
          <p className="text-xs text-sky-700">
            {t("admin.technicians.overview.cards.completedHint")}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {t("admin.technicians.overview.title")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("admin.technicians.overview.results", {
                count: filteredRows.length,
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="ui-search flex items-center gap-2 px-3 py-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="ui-search-icon h-4 w-4"
              >
                <circle cx="11" cy="11" r="7" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 20l-3-3"
                />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("admin.technicians.overview.placeholders.search")}
                className="ui-search-input w-56"
              />
            </div>
            <div className="ui-segment flex items-center gap-1">
              {(
                [
                  { id: "ALL", label: t("admin.technicians.overview.filters.all") },
                  { id: "ACTIVE", label: t("common.status.active") },
                  { id: "INACTIVE", label: t("admin.technicians.overview.filters.inactive") },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id)}
                  className={`ui-segment-item ${statusFilter === item.id ? "is-active" : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <select
              value={sortKey}
              onChange={(event) =>
                setSortKey(event.target.value as "pending" | "completed" | "name")
              }
              className="ui-select px-3 py-2 text-xs"
            >
              <option value="pending">{t("admin.technicians.overview.sort.pending")}</option>
              <option value="completed">{t("admin.technicians.overview.sort.completed")}</option>
              <option value="name">{t("admin.technicians.overview.sort.name")}</option>
            </select>
            <label
              htmlFor="new-tech"
              className="app-button-primary cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              {t("admin.technicians.overview.actions.new")}
            </label>
          </div>
        </div>

          <div className="ui-table-shell mt-5 overflow-hidden">
            {sortedRows.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-500">
                {t("admin.technicians.overview.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full text-left text-xs">
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
                            <span className="text-xs font-semibold">
                              {row.name
                                .split(" ")
                                .slice(0, 2)
                                .map((chunk) => chunk[0])
                                .join("")
                                .toUpperCase()}
                            </span>
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {row.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {row.email}
                            </p>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
