"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import { getJobStatusLabel } from "@/lib/constants";
import { useI18n } from "@/i18n/client";

type JobRow = {
  id: string;
  scheduledDate: string;
  status: string;
  priority: string;
  serviceType: string;
  serviceTierName?: string | null;
  type: string;
  propertyName: string;
  address: string;
  technicianName: string;
  photosCount: number;
};

type CustomerJobsTableProps = {
  rows: JobRow[];
  actionTargetId?: string;
  onDeleteJob?: (formData: FormData) => Promise<void>;
  customerId?: string;
};

const statusTone: Record<string, "info" | "warning" | "success"> = {
  SCHEDULED: "info",
  PENDING: "warning",
  ON_THE_WAY: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
};

const priorityTone: Record<string, "danger" | "info"> = {
  URGENT: "danger",
  NORMAL: "info",
};

const formatDateTime = (value: string, locale: string) =>
  new Date(value).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function CustomerJobsTable({
  rows,
  actionTargetId,
  onDeleteJob,
  customerId,
}: CustomerJobsTableProps) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [techFilter, setTechFilter] = useState("ALL");
  const [evidenceFilter, setEvidenceFilter] = useState("ALL");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const technicianOptions = useMemo(() => {
    const names = rows.map((row) => row.technicianName).filter(Boolean);
    return Array.from(new Set(names));
  }, [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (statusFilter !== "ALL" && row.status !== statusFilter) {
          return false;
        }
        if (priorityFilter !== "ALL" && row.priority !== priorityFilter) {
          return false;
        }
        if (serviceFilter !== "ALL" && row.serviceType !== serviceFilter) {
          return false;
        }
        if (techFilter !== "ALL" && row.technicianName !== techFilter) {
          return false;
        }
        if (evidenceFilter !== "ALL") {
          const hasEvidence = row.photosCount > 0;
          if (evidenceFilter === "WITH" && !hasEvidence) {
            return false;
          }
          if (evidenceFilter === "WITHOUT" && hasEvidence) {
            return false;
          }
        }
        if (startDate) {
          const start = new Date(`${startDate}T00:00:00`);
          if (new Date(row.scheduledDate) < start) {
            return false;
          }
        }
        if (endDate) {
          const end = new Date(`${endDate}T23:59:59`);
          if (new Date(row.scheduledDate) > end) {
            return false;
          }
        }
        if (query) {
          const haystack = `${row.propertyName} ${row.address} ${row.technicianName}`.toLowerCase();
          if (!haystack.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const diff =
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime();
        return sortDir === "asc" ? diff : -diff;
      });
  }, [
    rows,
    statusFilter,
    priorityFilter,
    serviceFilter,
    techFilter,
    evidenceFilter,
    startDate,
    endDate,
    search,
    sortDir,
  ]);

  return (
    <div className="ui-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {t("admin.customers.jobs.title")}
          </h2>
          <p className="text-xs text-slate-500">
            {t("admin.customers.jobs.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="app-chip px-3 py-1 text-xs" data-tone="info">
            {t("admin.customers.jobs.results", { count: filtered.length })}
          </span>
          {actionTargetId ? (
            <label
              htmlFor={actionTargetId}
              className="app-button-primary cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              {t("admin.customers.jobs.actions.schedule")}
            </label>
          ) : null}
        </div>
      </div>

      <div className="ui-filter-bar mt-4 flex flex-wrap items-center gap-2 px-3 py-3">
        <label className="ui-search flex flex-1 items-center gap-2 px-3 py-2 text-xs">
          <span className="ui-search-icon">{t("common.actions.search")}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.customers.jobs.placeholders.search")}
            className="ui-search-input w-full"
          />
        </label>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="ui-select px-3 py-2 text-xs"
        >
          <option value="ALL">{t("admin.customers.jobs.filters.status")}</option>
          <option value="SCHEDULED">{t("jobs.status.scheduled")}</option>
          <option value="PENDING">{t("jobs.status.pending")}</option>
          <option value="ON_THE_WAY">{t("jobs.status.onTheWay")}</option>
          <option value="IN_PROGRESS">{t("jobs.status.inProgress")}</option>
          <option value="COMPLETED">{t("jobs.status.completed")}</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          className="ui-select px-3 py-2 text-xs"
        >
          <option value="ALL">{t("admin.customers.jobs.filters.priority")}</option>
          <option value="NORMAL">{t("jobs.priority.normal")}</option>
          <option value="URGENT">{t("jobs.priority.urgent")}</option>
        </select>

        <select
          value={serviceFilter}
          onChange={(event) => setServiceFilter(event.target.value)}
          className="ui-select px-3 py-2 text-xs"
        >
          <option value="ALL">{t("admin.customers.jobs.filters.service")}</option>
          {serviceTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.labelKey ? t(option.labelKey) : option.label}
            </option>
          ))}
        </select>

        <select
          value={techFilter}
          onChange={(event) => setTechFilter(event.target.value)}
          className="ui-select px-3 py-2 text-xs"
        >
          <option value="ALL">{t("admin.customers.jobs.filters.technician")}</option>
          {technicianOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={evidenceFilter}
          onChange={(event) => setEvidenceFilter(event.target.value)}
          className="ui-select px-3 py-2 text-xs"
        >
          <option value="ALL">{t("admin.customers.jobs.filters.evidence")}</option>
          <option value="WITH">{t("admin.customers.jobs.filters.withEvidence")}</option>
          <option value="WITHOUT">{t("admin.customers.jobs.filters.withoutEvidence")}</option>
        </select>

        <label className="ui-search flex items-center gap-2 px-3 py-2 text-xs">
          <span>{t("admin.customers.jobs.filters.from")}</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="ui-search-input text-xs"
          />
        </label>
        <label className="ui-search flex items-center gap-2 px-3 py-2 text-xs">
          <span>{t("admin.customers.jobs.filters.to")}</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="ui-search-input text-xs"
          />
        </label>

        <button
          type="button"
          onClick={() => setSortDir((current) => (current === "asc" ? "desc" : "asc"))}
          className="ui-button-ghost px-3 py-2 text-[11px] font-semibold"
        >
          {sortDir === "asc"
            ? t("admin.customers.jobs.filters.upcoming")
            : t("admin.customers.jobs.filters.recent")}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[840px] w-full text-left text-xs text-slate-600">
          <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            <tr className="border-b border-slate-100">
              <th className="pb-3">{t("admin.customers.jobs.table.date")}</th>
              <th className="pb-3">{t("admin.customers.jobs.table.property")}</th>
              <th className="pb-3">{t("admin.customers.jobs.table.address")}</th>
              <th className="pb-3">{t("admin.customers.jobs.table.service")}</th>
              <th className="pb-3">{t("admin.customers.jobs.table.technician")}</th>
              <th className="pb-3">{t("admin.customers.jobs.table.status")}</th>
              <th className="pb-3">{t("admin.customers.jobs.table.priority")}</th>
              <th className="pb-3">{t("admin.customers.jobs.table.evidence")}</th>
              <th className="pb-3 text-right">{t("admin.customers.jobs.table.action")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-sm text-slate-500">
                  {t("admin.customers.jobs.empty")}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-slate-800">
                    {formatDateTime(row.scheduledDate, locale)}
                  </td>
                  <td className="py-3">
                    <p className="font-semibold text-slate-900">
                      {row.propertyName || t("admin.customers.jobs.propertyFallback")}
                    </p>
                  </td>
                  <td className="py-3 text-[11px] text-slate-500">
                    {row.address}
                  </td>
                  <td className="py-3 text-[11px] text-slate-500">
                    {
                      serviceTypeOptions.find(
                        (option) => option.value === row.serviceType
                      )?.labelKey
                        ? t(
                            serviceTypeOptions.find(
                              (option) => option.value === row.serviceType
                            )?.labelKey ?? row.serviceType
                          )
                        : serviceTypeOptions.find(
                            (option) => option.value === row.serviceType
                          )?.label ?? row.serviceType
                    }
                    {row.serviceTierName ? (
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {row.serviceTierName}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-[11px] text-slate-500">
                    {row.technicianName || t("admin.customers.jobs.noTech")}
                  </td>
                  <td className="py-3">
                    <span
                      className="app-chip px-3 py-1 text-[11px] font-semibold"
                      data-tone={statusTone[row.status] ?? "info"}
                    >
                      {getJobStatusLabel(row.status, t)}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className="app-chip px-3 py-1 text-[11px] font-semibold"
                      data-tone={priorityTone[row.priority] ?? "info"}
                    >
                      {row.priority === "URGENT"
                        ? t("jobs.priority.urgent")
                        : t("jobs.priority.normal")}
                    </span>
                  </td>
                  <td className="py-3 text-[11px] text-slate-500">
                    {row.photosCount > 0
                      ? t("admin.customers.jobs.evidenceCount", {
                          count: row.photosCount,
                        })
                      : t("admin.customers.jobs.noEvidence")}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/admin/routes/${row.id}`}
                        className="ui-button-ghost px-3 py-1 text-[11px] font-semibold"
                      >
                        {t("admin.customers.jobs.actions.view")}
                      </Link>
                      {onDeleteJob && customerId ? (
                        <form action={onDeleteJob}>
                          <input type="hidden" name="jobId" value={row.id} />
                          <input
                            type="hidden"
                            name="customerId"
                            value={customerId}
                          />
                          <button className="ui-button-ghost px-3 py-1 text-[11px] font-semibold">
                            {t("common.actions.delete")}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
