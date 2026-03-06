"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import { getJobStatusLabel } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import {
  endOfBusinessDay,
  formatInBusinessTimeZone,
  parseBusinessDateInput,
  startOfBusinessDay,
} from "@/lib/timezone";

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
};

type JobsFilterState = {
  search: string;
  status: string;
  priority: string;
  service: string;
  technician: string;
  evidence: string;
  fromDate: string;
  toDate: string;
  sortDir: "asc" | "desc";
};

const DEFAULT_FILTERS: JobsFilterState = {
  search: "",
  status: "ALL",
  priority: "ALL",
  service: "ALL",
  technician: "ALL",
  evidence: "ALL",
  fromDate: "",
  toDate: "",
  sortDir: "asc",
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

const PAGE_SIZE = 10;

const formatDateTime = (value: string, locale: string) =>
  formatInBusinessTimeZone(value, locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function CustomerJobsTable({ rows, actionTargetId }: CustomerJobsTableProps) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<JobsFilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<JobsFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isFiltersOpen) {
      return;
    }
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFiltersOpen(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isFiltersOpen]);

  const technicianOptions = useMemo(() => {
    const names = rows.map((row) => row.technicianName).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const fromDate = filters.fromDate
      ? startOfBusinessDay(parseBusinessDateInput(filters.fromDate) ?? new Date(filters.fromDate))
      : null;
    const toDate = filters.toDate
      ? endOfBusinessDay(parseBusinessDateInput(filters.toDate) ?? new Date(filters.toDate))
      : null;

    return rows
      .filter((row) => {
        if (filters.status !== "ALL" && row.status !== filters.status) {
          return false;
        }
        if (filters.priority !== "ALL" && row.priority !== filters.priority) {
          return false;
        }
        if (filters.service !== "ALL" && row.serviceType !== filters.service) {
          return false;
        }
        if (filters.technician !== "ALL" && row.technicianName !== filters.technician) {
          return false;
        }
        if (filters.evidence !== "ALL") {
          const hasEvidence = row.photosCount > 0;
          if (filters.evidence === "WITH" && !hasEvidence) {
            return false;
          }
          if (filters.evidence === "WITHOUT" && hasEvidence) {
            return false;
          }
        }
        if (fromDate && new Date(row.scheduledDate) < fromDate) {
          return false;
        }
        if (toDate && new Date(row.scheduledDate) > toDate) {
          return false;
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
        const diff = new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
        return filters.sortDir === "asc" ? diff : -diff;
      });
  }, [rows, filters]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search.trim()) {
      count += 1;
    }
    if (filters.status !== "ALL") {
      count += 1;
    }
    if (filters.priority !== "ALL") {
      count += 1;
    }
    if (filters.service !== "ALL") {
      count += 1;
    }
    if (filters.technician !== "ALL") {
      count += 1;
    }
    if (filters.evidence !== "ALL") {
      count += 1;
    }
    if (filters.fromDate) {
      count += 1;
    }
    if (filters.toDate) {
      count += 1;
    }
    if (filters.sortDir !== "asc") {
      count += 1;
    }
    return count;
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredRows]);

  const allLabel = locale === "es" ? "Todos" : "All";

  const openFiltersModal = () => {
    setDraftFilters(filters);
    setIsFiltersOpen(true);
  };

  const closeFiltersModal = () => {
    setIsFiltersOpen(false);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setIsFiltersOpen(false);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const openJobDetail = (jobId: string) => {
    router.push(`/admin/routes/${jobId}`);
  };

  return (
    <section className="customers-panel ui-panel flex min-w-0 flex-col overflow-hidden p-4 sm:p-6 lg:min-h-[460px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.customers.jobs.title")}</h2>
          <p className="text-xs text-slate-500">{t("admin.customers.jobs.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="app-chip px-3 py-1 text-xs" data-tone="info">
            {t("admin.customers.jobs.results", { count: filteredRows.length })}
          </span>
          <button
            type="button"
            onClick={openFiltersModal}
            className="ui-button-ghost px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
          >
            {t("admin.customers.jobs.filters.open")}
          </button>
          {activeFilterCount > 0 ? (
            <span className="app-chip px-3 py-1 text-xs" data-tone="info">
              {t("admin.customers.jobs.filters.activeCount", { count: activeFilterCount })}
            </span>
          ) : null}
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={resetFilters}
              className="ui-button-ghost px-3 py-2 text-[11px] font-semibold"
            >
              {t("admin.customers.jobs.filters.reset")}
            </button>
          ) : null}
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

      <div className="customers-table-shell ui-table-shell mt-4 min-h-0 flex-1 overflow-hidden">
        <div className="customers-table-scroll h-full overflow-auto">
          <table className="customers-table customer-jobs-table w-full min-w-[840px] text-left text-xs text-slate-600">
            <thead className="sticky top-0 z-10 border-b border-slate-800/40 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-[11px] uppercase tracking-[0.2em] text-slate-100/85">
              <tr>
                <th className="w-[14%] px-2 py-2">{t("admin.customers.jobs.table.date")}</th>
                <th className="w-[20%] px-2 py-2">{t("admin.customers.jobs.table.property")}</th>
                <th className="hidden w-[22%] px-2 py-2 xl:table-cell">
                  {t("admin.customers.jobs.table.address")}
                </th>
                <th className="w-[18%] px-2 py-2">{t("admin.customers.jobs.table.service")}</th>
                <th className="hidden w-[12%] px-2 py-2 lg:table-cell">
                  {t("admin.customers.jobs.table.technician")}
                </th>
                <th className="w-[12%] px-2 py-2">{t("admin.customers.jobs.table.status")}</th>
                <th className="hidden w-[10%] px-2 py-2 sm:table-cell">
                  {t("admin.customers.jobs.table.priority")}
                </th>
                <th className="hidden w-[10%] px-2 py-2 md:table-cell">
                  {t("admin.customers.jobs.table.evidence")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                    {t("admin.customers.jobs.empty")}
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const serviceOption = serviceTypeOptions.find(
                    (option) => option.value === row.serviceType
                  );
                  const serviceLabel = serviceOption?.labelKey
                    ? t(serviceOption.labelKey)
                    : serviceOption?.label ?? row.serviceType;
                  const propertyLabel = row.propertyName || t("admin.customers.jobs.propertyFallback");
                  const technicianLabel = row.technicianName || t("admin.customers.jobs.noTech");

                  return (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openJobDetail(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openJobDetail(row.id);
                        }
                      }}
                      aria-label={`${propertyLabel} - ${formatDateTime(row.scheduledDate, locale)}`}
                      className="cursor-pointer bg-white transition hover:bg-sky-50/40 focus-visible:bg-sky-50/40"
                    >
                      <td className="px-2 py-2 text-[11px] font-semibold text-slate-900">
                        {formatDateTime(row.scheduledDate, locale)}
                      </td>
                      <td className="px-2 py-2">
                        <p className="max-w-[12rem] truncate font-semibold text-slate-900" title={propertyLabel}>
                          {propertyLabel}
                        </p>
                        <p className="max-w-[12rem] truncate text-[10px] text-slate-500 xl:hidden" title={row.address}>
                          {row.address}
                        </p>
                      </td>
                      <td className="hidden px-2 py-2 text-[11px] text-slate-500 xl:table-cell">
                        <p className="max-w-[16rem] truncate" title={row.address}>
                          {row.address}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-[11px] text-slate-600">
                        <p className="max-w-[13rem] truncate font-medium" title={serviceLabel}>
                          {serviceLabel}
                        </p>
                        {row.serviceTierName ? (
                          <p
                            className="max-w-[13rem] truncate text-[10px] text-slate-400"
                            title={row.serviceTierName}
                          >
                            {row.serviceTierName}
                          </p>
                        ) : null}
                      </td>
                      <td className="hidden px-2 py-2 text-[11px] text-slate-600 lg:table-cell">
                        <p className="max-w-[10rem] truncate" title={technicianLabel}>
                          {technicianLabel}
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="app-chip px-2.5 py-1 text-[10px] font-semibold"
                          data-tone={statusTone[row.status] ?? "info"}
                        >
                          {getJobStatusLabel(row.status, t)}
                        </span>
                      </td>
                      <td className="hidden px-2 py-2 sm:table-cell">
                        <span
                          className="app-chip px-2.5 py-1 text-[10px] font-semibold"
                          data-tone={priorityTone[row.priority] ?? "info"}
                        >
                          {row.priority === "URGENT"
                            ? t("jobs.priority.urgent")
                            : t("jobs.priority.normal")}
                        </span>
                      </td>
                      <td className="hidden px-2 py-2 text-[11px] text-slate-500 md:table-cell">
                        {row.photosCount > 0
                          ? t("admin.customers.jobs.evidenceCount", { count: row.photosCount })
                          : t("admin.customers.jobs.noEvidence")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRows.length > 0 ? (
        <div className="sticky bottom-0 z-[1] mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white pt-3 text-xs text-slate-500">
          <span>
            {`${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(
              currentPage * PAGE_SIZE,
              filteredRows.length
            )} / ${filteredRows.length}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage <= 1}
              className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 disabled:opacity-50"
            >
              {t("admin.customers.overview.prev")}
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
              {t("admin.customers.overview.next")}
            </button>
          </div>
        </div>
      ) : null}

      {isMounted && isFiltersOpen
        ? createPortal(
            <div className="app-modal-layer fixed inset-0 z-[2400] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
              <button
                type="button"
                onClick={closeFiltersModal}
                className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
                aria-label={t("common.actions.close")}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t("admin.customers.jobs.filters.modalTitle")}
                className="app-modal-card relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                  <div className="app-modal-header">
                    <div>
                      <p className="app-modal-kicker">{t("admin.customers.jobs.filters.open")}</p>
                      <h3 className="app-modal-title">{t("admin.customers.jobs.filters.modalTitle")}</h3>
                      <p className="app-modal-subtitle">
                        {t("admin.customers.jobs.filters.modalSubtitle")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeFiltersModal}
                      className="app-modal-close"
                      aria-label={t("common.actions.close")}
                      title={t("common.actions.close")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-4 w-4"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <section className="app-modal-section">
                      <p className="app-modal-section-title">
                        {t("admin.customers.jobs.filters.search")}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="sm:col-span-2">
                          <span className="app-modal-field-label">
                            {t("admin.customers.jobs.filters.search")}
                          </span>
                          <input
                            value={draftFilters.search}
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                search: event.target.value,
                              }))
                            }
                            placeholder={t("admin.customers.jobs.placeholders.search")}
                            className="app-modal-input app-input"
                          />
                        </label>
                        <label>
                          <span className="app-modal-field-label">
                            {t("admin.customers.jobs.filters.sort")}
                          </span>
                          <select
                            value={draftFilters.sortDir}
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                sortDir: event.target.value as "asc" | "desc",
                              }))
                            }
                            className="app-modal-input ui-select"
                          >
                            <option value="asc">{t("admin.customers.jobs.filters.upcoming")}</option>
                            <option value="desc">{t("admin.customers.jobs.filters.recent")}</option>
                          </select>
                        </label>
                        <label>
                          <span className="app-modal-field-label">
                            {t("admin.customers.jobs.filters.evidence")}
                          </span>
                          <select
                            value={draftFilters.evidence}
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                evidence: event.target.value,
                              }))
                            }
                            className="app-modal-input ui-select"
                          >
                            <option value="ALL">
                              {t("admin.customers.jobs.filters.evidence")}: {allLabel}
                            </option>
                            <option value="WITH">
                              {t("admin.customers.jobs.filters.withEvidence")}
                            </option>
                            <option value="WITHOUT">
                              {t("admin.customers.jobs.filters.withoutEvidence")}
                            </option>
                          </select>
                        </label>
                      </div>
                    </section>

                    <section className="app-modal-section">
                      <p className="app-modal-section-title">
                        {t("admin.customers.jobs.filters.status")}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label>
                          <span className="app-modal-field-label">
                            {t("admin.customers.jobs.filters.status")}
                          </span>
                          <select
                            value={draftFilters.status}
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                status: event.target.value,
                              }))
                            }
                            className="app-modal-input ui-select"
                          >
                            <option value="ALL">
                              {t("admin.customers.jobs.filters.status")}: {allLabel}
                            </option>
                            <option value="SCHEDULED">{t("jobs.status.scheduled")}</option>
                            <option value="PENDING">{t("jobs.status.pending")}</option>
                            <option value="ON_THE_WAY">{t("jobs.status.onTheWay")}</option>
                            <option value="IN_PROGRESS">{t("jobs.status.inProgress")}</option>
                            <option value="COMPLETED">{t("jobs.status.completed")}</option>
                          </select>
                        </label>

                        <label>
                          <span className="app-modal-field-label">
                            {t("admin.customers.jobs.filters.priority")}
                          </span>
                          <select
                            value={draftFilters.priority}
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                priority: event.target.value,
                              }))
                            }
                            className="app-modal-input ui-select"
                          >
                            <option value="ALL">
                              {t("admin.customers.jobs.filters.priority")}: {allLabel}
                            </option>
                            <option value="NORMAL">{t("jobs.priority.normal")}</option>
                            <option value="URGENT">{t("jobs.priority.urgent")}</option>
                          </select>
                        </label>

                        <label>
                          <span className="app-modal-field-label">
                            {t("admin.customers.jobs.filters.service")}
                          </span>
                          <select
                            value={draftFilters.service}
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                service: event.target.value,
                              }))
                            }
                            className="app-modal-input ui-select"
                          >
                            <option value="ALL">
                              {t("admin.customers.jobs.filters.service")}: {allLabel}
                            </option>
                            {serviceTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.labelKey ? t(option.labelKey) : option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span className="app-modal-field-label">
                            {t("admin.customers.jobs.filters.technician")}
                          </span>
                          <select
                            value={draftFilters.technician}
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                technician: event.target.value,
                              }))
                            }
                            className="app-modal-input ui-select"
                          >
                            <option value="ALL">
                              {t("admin.customers.jobs.filters.technician")}: {allLabel}
                            </option>
                            {technicianOptions.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </section>

                    <section className="app-modal-section">
                      <p className="app-modal-section-title">
                        {t("admin.customers.jobs.filters.dateRange")}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label>
                          <span className="app-modal-field-label">
                            {t("admin.customers.jobs.filters.from")}
                          </span>
                          <input
                            type="date"
                            value={draftFilters.fromDate}
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                fromDate: event.target.value,
                              }))
                            }
                            className="app-modal-input app-input"
                          />
                        </label>
                        <label>
                          <span className="app-modal-field-label">
                            {t("admin.customers.jobs.filters.to")}
                          </span>
                          <input
                            type="date"
                            value={draftFilters.toDate}
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                toDate: event.target.value,
                              }))
                            }
                            className="app-modal-input app-input"
                          />
                        </label>
                      </div>
                    </section>
                  </div>

                  <div className="app-modal-actions mt-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setDraftFilters(DEFAULT_FILTERS)}
                      className="ui-button-ghost px-4 py-2 text-xs font-semibold"
                    >
                      {t("admin.customers.jobs.filters.reset")}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={closeFiltersModal}
                        className="ui-button-ghost px-4 py-2 text-xs font-semibold"
                      >
                        {t("common.actions.cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={applyFilters}
                        className="app-button-primary px-4 py-2 text-xs font-semibold"
                      >
                        {t("admin.customers.jobs.filters.apply")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
