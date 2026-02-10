"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import { getJobStatusLabel } from "@/lib/constants";
import { useI18n } from "@/i18n/client";

type JobRow = {
  id: string;
  scheduledDate: string;
  customerName: string;
  propertyName: string;
  address: string;
  status: string;
  priority: string;
  serviceType: string;
  serviceTierName?: string | null;
  type: string;
  photosCount: number;
};

type TableMode = "future" | "past";

type SectionProps = {
  title: string;
  subtitle: string;
  rows: JobRow[];
  mode: TableMode;
  showEvidenceFilter?: boolean;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
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

const formatDayLabel = (value: Date, locale: string) =>
  value
    .toLocaleDateString(locale, { weekday: "short" })
    .replace(".", "")
    .toUpperCase();

const formatTime = (value: string, locale: string) =>
  new Date(value).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

const toDateInput = (value: Date) => value.toLocaleDateString("en-CA");

const buildCalendarDays = (start: Date, count: number, locale: string) =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      date,
      label: formatDayLabel(date, locale),
      number: date.getDate(),
    };
  });

const filterRows = (
  rows: JobRow[],
  {
    search,
    statusFilter,
    priorityFilter,
    serviceFilter,
    evidenceFilter,
    startDate,
    endDate,
    showEvidenceFilter,
  }: {
    search: string;
    statusFilter: string;
    priorityFilter: string;
    serviceFilter: string;
    evidenceFilter: string;
    startDate: string;
    endDate: string;
    showEvidenceFilter?: boolean;
  }
) => {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (statusFilter !== "ALL" && row.status !== statusFilter) {
      return false;
    }
    if (priorityFilter !== "ALL" && row.priority !== priorityFilter) {
      return false;
    }
    if (serviceFilter !== "ALL" && row.serviceType !== serviceFilter) {
      return false;
    }
    if (showEvidenceFilter && evidenceFilter !== "ALL") {
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
      const haystack = `${row.customerName} ${row.propertyName} ${row.address}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
};

const IconSearch = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    className={className}
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const IconCalendar = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    className={className}
  >
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);

const DateFilterPopover = ({
  mode,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  t,
}: {
  mode: TableMode;
  startDate: string;
  endDate: string;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) => {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("ALL");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const applyPreset = (value: string) => {
    setPreset(value);
    if (value === "ALL") {
      setStartDate("");
      setEndDate("");
      return;
    }
    if (value === "CUSTOM") {
      return;
    }
    const days = Number(value);
    const today = new Date();
    const start =
      mode === "future" ? new Date(today) : new Date(today.getTime() - days * 86400000);
    const end =
      mode === "future"
        ? new Date(today.getTime() + days * 86400000)
        : new Date(today);
    setStartDate(toDateInput(start));
    setEndDate(toDateInput(end));
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
      >
        <IconCalendar className="h-4 w-4 text-slate-500" />
        {t("admin.technicians.detail.jobs.filters.date")}
      </button>
      <div
        className={`absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg transition ${
          open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        }`}
        style={{ transformOrigin: "top right" }}
      >
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {t("admin.technicians.detail.jobs.filters.quickRange")}
            </label>
            <select
              value={preset}
              onChange={(event) => applyPreset(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
            >
              <option value="ALL">{t("admin.technicians.detail.jobs.filters.all")}</option>
              <option value="7">{t("admin.technicians.detail.jobs.filters.next7")}</option>
              <option value="14">{t("admin.technicians.detail.jobs.filters.next14")}</option>
              <option value="30">{t("admin.technicians.detail.jobs.filters.next30")}</option>
              <option value="CUSTOM">
                {t("admin.technicians.detail.jobs.filters.custom")}
              </option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {t("admin.technicians.detail.jobs.filters.from")}
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setPreset("CUSTOM");
                  setStartDate(event.target.value);
                }}
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {t("admin.technicians.detail.jobs.filters.to")}
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setPreset("CUSTOM");
                  setEndDate(event.target.value);
                }}
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
          >
            {t("admin.technicians.detail.jobs.filters.apply")}
          </button>
        </div>
      </div>
    </div>
  );
};

const FiltersBar = ({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  serviceFilter,
  setServiceFilter,
  evidenceFilter,
  setEvidenceFilter,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  mode,
  showEvidenceFilter,
  sortDir,
  setSortDir,
  clearFilters,
  statusOptions,
  t,
}: {
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  priorityFilter: string;
  setPriorityFilter: (value: string) => void;
  serviceFilter: string;
  setServiceFilter: (value: string) => void;
  evidenceFilter: string;
  setEvidenceFilter: (value: string) => void;
  startDate: string;
  endDate: string;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  mode: TableMode;
  showEvidenceFilter?: boolean;
  sortDir: "asc" | "desc";
  setSortDir: (value: "asc" | "desc") => void;
  clearFilters: () => void;
  statusOptions: string[];
  t: (key: string, values?: Record<string, string | number>) => string;
}) => (
  <div className="ui-filter-bar mt-4 flex flex-wrap items-center gap-2 px-3 py-3">
    <label className="ui-search flex min-w-[220px] flex-1 items-center gap-2 px-3 py-2 text-xs">
      <IconSearch className="ui-search-icon h-4 w-4" />
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("admin.technicians.detail.jobs.filters.search")}
        className="ui-search-input w-full"
      />
    </label>

    <select
      value={statusFilter}
      onChange={(event) => setStatusFilter(event.target.value)}
      className="ui-select px-3 py-2 text-xs"
    >
      <option value="ALL">{t("admin.technicians.detail.jobs.filters.status")}</option>
      {statusOptions.map((status) => (
        <option key={status} value={status}>
          {getJobStatusLabel(status, t)}
        </option>
      ))}
    </select>

    <select
      value={priorityFilter}
      onChange={(event) => setPriorityFilter(event.target.value)}
      className="ui-select px-3 py-2 text-xs"
    >
      <option value="ALL">
        {t("admin.technicians.detail.jobs.filters.priority")}
      </option>
      <option value="NORMAL">{t("jobs.priority.normal")}</option>
      <option value="URGENT">{t("jobs.priority.urgent")}</option>
    </select>

    <select
      value={serviceFilter}
      onChange={(event) => setServiceFilter(event.target.value)}
      className="ui-select px-3 py-2 text-xs"
    >
      <option value="ALL">
        {t("admin.technicians.detail.jobs.filters.service")}
      </option>
      {serviceTypeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.labelKey ? t(option.labelKey) : option.label}
        </option>
      ))}
    </select>

    {showEvidenceFilter ? (
      <select
        value={evidenceFilter}
        onChange={(event) => setEvidenceFilter(event.target.value)}
        className="ui-select px-3 py-2 text-xs"
      >
        <option value="ALL">
          {t("admin.technicians.detail.jobs.filters.evidence")}
        </option>
        <option value="WITH">
          {t("admin.technicians.detail.jobs.filters.withEvidence")}
        </option>
        <option value="WITHOUT">
          {t("admin.technicians.detail.jobs.filters.withoutEvidence")}
        </option>
      </select>
    ) : null}

    <DateFilterPopover
      mode={mode}
      startDate={startDate}
      endDate={endDate}
      setStartDate={setStartDate}
      setEndDate={setEndDate}
      t={t}
    />

    <button
      type="button"
      onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
      className="ui-button-ghost px-3 py-2 text-[11px] font-semibold"
    >
      {sortDir === "asc"
        ? mode === "future"
          ? t("admin.technicians.detail.jobs.filters.sortUpcoming")
          : t("admin.technicians.detail.jobs.filters.sortOldest")
        : mode === "future"
          ? t("admin.technicians.detail.jobs.filters.sortFarthest")
          : t("admin.technicians.detail.jobs.filters.sortRecent")}
    </button>

    <button
      type="button"
      onClick={clearFilters}
      className="ui-button-ghost px-3 py-2 text-[11px] font-semibold"
    >
      {t("admin.technicians.detail.jobs.filters.clear")}
    </button>
  </div>
);

const UpcomingCalendarSection = ({
  title,
  subtitle,
  rows,
  mode,
  locale,
  t,
}: SectionProps) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status))),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const filtered = filterRows(rows, {
      search,
      statusFilter,
      priorityFilter,
      serviceFilter,
      evidenceFilter: "ALL",
      startDate,
      endDate,
    });
    return filtered.sort((a, b) => {
      const diff =
        new Date(a.scheduledDate).getTime() -
        new Date(b.scheduledDate).getTime();
      return sortDir === "asc" ? diff : -diff;
    });
  }, [
    rows,
    search,
    statusFilter,
    priorityFilter,
    serviceFilter,
    startDate,
    endDate,
    sortDir,
  ]);

  const calendarStart = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
  calendarStart.setHours(0, 0, 0, 0);
  const daysCount = endDate
    ? Math.min(
        30,
        Math.max(
          7,
          Math.round(
            (new Date(`${endDate}T00:00:00`).getTime() -
              calendarStart.getTime()) /
              86400000
          ) + 1
        )
      )
    : 7;

  const calendarDays = useMemo(
    () => buildCalendarDays(calendarStart, daysCount, locale),
    [calendarStart.getTime(), daysCount, locale]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, JobRow[]>();
    filteredRows.forEach((row) => {
      const key = new Date(row.scheduledDate).toISOString().slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    });
    map.forEach((list) =>
      list.sort(
        (a, b) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime()
      )
    );
    return map;
  }, [filteredRows]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setServiceFilter("ALL");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
          {t("admin.technicians.detail.jobs.results", {
            count: filteredRows.length,
          })}
        </span>
      </div>

      <FiltersBar
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        serviceFilter={serviceFilter}
        setServiceFilter={setServiceFilter}
        evidenceFilter="ALL"
        setEvidenceFilter={() => undefined}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        mode={mode}
        sortDir={sortDir}
        setSortDir={setSortDir}
        clearFilters={clearFilters}
        statusOptions={statusOptions}
        t={t}
      />

      <div className="mt-4 overflow-x-auto">
        <div className="grid auto-cols-[minmax(190px,1fr)] grid-flow-col gap-3">
          {calendarDays.map((day) => {
            const dayRows = grouped.get(day.key) ?? [];
            return (
              <div
                key={day.key}
                className="min-h-[220px] rounded-2xl border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {day.label}
                  </span>
                  <span className="text-base font-semibold text-slate-900">
                    {day.number}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {dayRows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-400">
                      {t("admin.technicians.detail.jobs.emptyDay")}
                    </div>
                  ) : (
                    dayRows.map((row) => {
                      const serviceLabel =
                        serviceTypeOptions.find(
                          (option) => option.value === row.serviceType
                        )?.label ?? row.serviceType;
                      const tierLabel = row.serviceTierName;
                      return (
                        <Link
                          key={row.id}
                          href={`/admin/routes/${row.id}`}
                          className="ui-link-card group block p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="app-chip px-2 py-0.5 text-[10px] font-semibold"
                              data-tone="info"
                            >
                              {formatTime(row.scheduledDate, locale)}
                            </span>
                            <span
                              className="app-chip px-2 py-0.5 text-[10px] font-semibold"
                              data-tone={priorityTone[row.priority] ?? "info"}
                            >
                              {row.priority === "URGENT"
                                ? t("jobs.priority.urgent")
                                : t("jobs.priority.normal")}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900 truncate">
                            {row.customerName}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {row.address}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                            <span>
                              {tierLabel ? `${tierLabel} - ` : ""}
                              {serviceLabel}
                            </span>
                            <span
                              className="app-chip px-2 py-0.5 text-[10px] font-semibold"
                              data-tone={statusTone[row.status] ?? "info"}
                            >
                              {getJobStatusLabel(row.status, t)}
                            </span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const CompletedTableSection = ({
  title,
  subtitle,
  rows,
  mode,
  showEvidenceFilter,
  locale,
  t,
}: SectionProps) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [evidenceFilter, setEvidenceFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status))),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const filtered = filterRows(rows, {
      search,
      statusFilter,
      priorityFilter,
      serviceFilter,
      evidenceFilter,
      startDate,
      endDate,
      showEvidenceFilter,
    });
    return filtered.sort((a, b) => {
      const diff =
        new Date(a.scheduledDate).getTime() -
        new Date(b.scheduledDate).getTime();
      return sortDir === "asc" ? diff : -diff;
    });
  }, [
    rows,
    search,
    statusFilter,
    priorityFilter,
    serviceFilter,
    evidenceFilter,
    startDate,
    endDate,
    showEvidenceFilter,
    sortDir,
  ]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setServiceFilter("ALL");
    setEvidenceFilter("ALL");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
          {t("admin.technicians.detail.jobs.results", {
            count: filteredRows.length,
          })}
        </span>
      </div>

      <FiltersBar
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        serviceFilter={serviceFilter}
        setServiceFilter={setServiceFilter}
        evidenceFilter={evidenceFilter}
        setEvidenceFilter={setEvidenceFilter}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        mode={mode}
        showEvidenceFilter={showEvidenceFilter}
        sortDir={sortDir}
        setSortDir={setSortDir}
        clearFilters={clearFilters}
        statusOptions={statusOptions}
        t={t}
      />

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-[12px] text-slate-600">
          <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            <tr className="border-b border-slate-100">
              <th className="pb-3">{t("admin.technicians.detail.jobs.table.date")}</th>
              <th className="pb-3">{t("admin.technicians.detail.jobs.table.customer")}</th>
              <th className="pb-3">{t("admin.technicians.detail.jobs.table.address")}</th>
              <th className="pb-3">{t("admin.technicians.detail.jobs.table.service")}</th>
              <th className="pb-3">{t("admin.technicians.detail.jobs.table.priority")}</th>
              <th className="pb-3">{t("admin.technicians.detail.jobs.table.status")}</th>
              {showEvidenceFilter ? (
                <th className="pb-3">{t("admin.technicians.detail.jobs.table.evidence")}</th>
              ) : null}
              <th className="pb-3 text-right">
                {t("admin.technicians.detail.jobs.table.action")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={showEvidenceFilter ? 8 : 7}
                  className="py-6 text-center text-sm text-slate-500"
                >
                  {t("admin.technicians.detail.jobs.table.empty")}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-100 ${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                  } hover:bg-slate-50/80`}
                >
                  <td className="py-3 font-medium text-slate-800">
                    {formatDateTime(row.scheduledDate, locale)}
                  </td>
                  <td className="py-3">
                    <p className="font-semibold text-slate-900">
                      {row.customerName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {row.propertyName || "Propiedad"}
                    </p>
                  </td>
                  <td className="py-3 text-[11px] text-slate-500">
                    <p className="max-w-[220px] truncate">{row.address}</p>
                  </td>
                  <td className="py-3 text-[11px] text-slate-500">
                    {
                      serviceTypeOptions.find(
                        (option) => option.value === row.serviceType
                      )?.label ?? row.serviceType
                    }
                    {row.serviceTierName ? (
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {row.serviceTierName}
                      </span>
                    ) : null}
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
                  <td className="py-3">
                    <span
                      className="app-chip px-3 py-1 text-[11px] font-semibold"
                      data-tone={statusTone[row.status] ?? "info"}
                    >
                      {getJobStatusLabel(row.status, t)}
                    </span>
                  </td>
                  {showEvidenceFilter ? (
                    <td className="py-3 text-[11px] text-slate-500">
                      {row.photosCount > 0
                        ? t("admin.technicians.detail.jobs.evidenceCount", {
                            count: row.photosCount,
                          })
                        : t("admin.technicians.detail.jobs.noEvidence")}
                    </td>
                  ) : null}
                  <td className="py-3 text-right">
                    <Link
                      href={`/admin/routes/${row.id}`}
                      className="ui-button-ghost px-3 py-1 text-[11px] font-semibold"
                    >
                      {t("admin.technicians.detail.jobs.table.viewJob")}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function TechnicianJobsTables({
  upcoming,
  completed,
}: {
  upcoming: JobRow[];
  completed: JobRow[];
}) {
  const { t, locale } = useI18n();
  return (
    <div className="space-y-6">
      <UpcomingCalendarSection
        title={t("admin.technicians.detail.jobs.upcomingTitle")}
        subtitle={t("admin.technicians.detail.jobs.upcomingSubtitle")}
        rows={upcoming}
        mode="future"
        locale={locale}
        t={t}
      />
      <CompletedTableSection
        title={t("admin.technicians.detail.jobs.completedTitle")}
        subtitle={t("admin.technicians.detail.jobs.completedSubtitle")}
        rows={completed}
        mode="past"
        showEvidenceFilter
        locale={locale}
        t={t}
      />
    </div>
  );
}
