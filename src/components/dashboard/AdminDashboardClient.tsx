"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import StatCard from "@/components/ui/StatCard";
import { useI18n } from "@/i18n/client";
import { getJobStatusLabel } from "@/lib/constants";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

type DashboardJob = {
  id: string;
  scheduledDateIso: string;
  status: "SCHEDULED" | "PENDING" | "ON_THE_WAY" | "IN_PROGRESS" | "COMPLETED";
  type: "ROUTINE" | "ON_DEMAND";
  customerName: string;
  customerEmail: string | null;
  address: string;
};

type DashboardInvoice = {
  id: string;
  number: string;
  total: number;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE";
  customerName: string;
};

type DashboardStats = {
  jobsToday: number;
  pendingJobs: number;
  completedJobs: number;
  customers: number;
  onDemandJobs: number;
  completedWithEvidence: number;
};

type AdminDashboardClientProps = {
  jobs: DashboardJob[];
  invoices: DashboardInvoice[];
  stats: DashboardStats;
};

type RouteFilter = "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ON_DEMAND";
type InvoiceFilter = "ALL" | "OPEN" | "PAID";

const routeStatusTone: Record<
  DashboardJob["status"],
  "info" | "warning" | "success"
> = {
  SCHEDULED: "info",
  PENDING: "warning",
  ON_THE_WAY: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
};

function invoiceStatusLabel(
  status: DashboardInvoice["status"],
  t: (key: string) => string
) {
  if (status === "DRAFT") return t("admin.invoices.status.draft");
  if (status === "SENT") return t("admin.invoices.status.sent");
  if (status === "PAID") return t("admin.invoices.status.paid");
  return t("admin.invoices.status.overdue");
}

function formatLocalTime(dateIso: string) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TIMEZONE,
  });
}

function getInvoiceHref(invoice: DashboardInvoice) {
  if (invoice.status === "DRAFT") {
    return `/admin/invoices/${invoice.id}?mode=editor`;
  }
  return `/admin/invoices/${invoice.id}?mode=web`;
}

export default function AdminDashboardClient({
  jobs,
  invoices,
  stats,
}: AdminDashboardClientProps) {
  const { t } = useI18n();
  const [routeFilter, setRouteFilter] = useState<RouteFilter>("ALL");
  const [search, setSearch] = useState("");
  const [routeFiltersOpen, setRouteFiltersOpen] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>("ALL");
  const routeFilterOptions = [
    { key: "ALL" as const, label: t("admin.dashboard.interactive.filters.all") },
    { key: "PENDING" as const, label: t("admin.dashboard.interactive.filters.pending") },
    {
      key: "IN_PROGRESS" as const,
      label: t("admin.dashboard.interactive.filters.inProgress"),
    },
    {
      key: "COMPLETED" as const,
      label: t("admin.dashboard.interactive.filters.completed"),
    },
    {
      key: "ON_DEMAND" as const,
      label: t("admin.dashboard.interactive.filters.onDemand"),
    },
  ];

  const completionRate = stats.jobsToday
    ? Math.round((stats.completedJobs / stats.jobsToday) * 100)
    : 0;
  const evidenceRate = stats.completedJobs
    ? Math.round((stats.completedWithEvidence / stats.completedJobs) * 100)
    : 0;

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      if (routeFilter === "ON_DEMAND" && job.type !== "ON_DEMAND") return false;
      if (
        routeFilter === "PENDING" &&
        job.status !== "PENDING" &&
        job.status !== "SCHEDULED"
      ) {
        return false;
      }
      if (
        routeFilter === "IN_PROGRESS" &&
        job.status !== "IN_PROGRESS" &&
        job.status !== "ON_THE_WAY"
      ) {
        return false;
      }
      if (routeFilter === "COMPLETED" && job.status !== "COMPLETED") return false;
      if (!query) return true;
      return (
        job.customerName.toLowerCase().includes(query) ||
        (job.customerEmail ?? "").toLowerCase().includes(query) ||
        job.address.toLowerCase().includes(query)
      );
    });

    filtered.sort((a, b) => {
      return (
        new Date(a.scheduledDateIso).getTime() - new Date(b.scheduledDateIso).getTime()
      );
    });

    return filtered;
  }, [jobs, routeFilter, search]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (invoiceFilter === "PAID") return invoice.status === "PAID";
      if (invoiceFilter === "OPEN") return invoice.status !== "PAID";
      return true;
    });
  }, [invoiceFilter, invoices]);
  const activeRouteFiltersCount = [
    routeFilter !== "ALL",
    search.trim().length > 0,
  ].filter(Boolean).length;

  const openRouteFilters = () => {
    setRouteFiltersOpen(true);
  };

  const resetRouteFilters = () => {
    setRouteFilter("ALL");
    setSearch("");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("admin.dashboard.stats.jobsToday")}
          value={`${stats.jobsToday}`}
          helper={t("admin.dashboard.stats.inRoute")}
          tone="info"
        />
        <StatCard
          label={t("admin.dashboard.stats.pending")}
          value={`${stats.pendingJobs}`}
          helper={t("admin.dashboard.stats.pendingToday")}
          tone="warning"
        />
        <StatCard
          label={t("admin.dashboard.stats.completed")}
          value={`${stats.completedJobs}`}
          helper={t("admin.dashboard.stats.withEvidence")}
          tone="success"
        />
        <StatCard
          label={t("admin.dashboard.stats.customers")}
          value={`${stats.customers}`}
          helper={t("admin.dashboard.stats.activeBase")}
          tone="info"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="app-card p-4 shadow-contrast sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {t("admin.dashboard.todayRoute.title")}
            </h2>
            <div className="flex items-center gap-2">
              <span className="app-chip px-3 py-1 text-xs" data-tone="info">
                {t("admin.dashboard.todayRoute.count", {
                  count: filteredJobs.length,
                })}
              </span>
              {activeRouteFiltersCount > 0 ? (
                <span className="app-chip px-3 py-1 text-xs" data-tone="warning">
                  {t("admin.dashboard.interactive.activeCount", {
                    count: activeRouteFiltersCount,
                  })}
                </span>
              ) : null}
              <button
                type="button"
                onClick={openRouteFilters}
                className="app-button-ghost inline-flex h-9 w-9 items-center justify-center rounded-full p-0"
                aria-label={t("admin.dashboard.interactive.openFilters")}
                title={t("admin.dashboard.interactive.openFilters")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                <span className="sr-only">{t("admin.dashboard.interactive.openFilters")}</span>
              </button>
              <Link
                href="/admin/routes"
                className="app-button-ghost px-3 py-1.5 text-xs font-semibold"
              >
                {t("admin.dashboard.todayRoute.viewAll")}
              </Link>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-slate-600">
                {t("admin.dashboard.todayRoute.count", {
                  count: filteredJobs.length,
                })}
              </p>
              {routeFilter !== "ALL" ? (
                <span className="app-chip px-2.5 py-1 text-[11px]" data-tone="info">
                  {routeFilterOptions.find((item) => item.key === routeFilter)?.label ??
                    t("admin.dashboard.interactive.filters.all")}
                </span>
              ) : null}
              {search.trim() ? (
                <span className="app-chip max-w-[220px] truncate px-2.5 py-1 text-[11px]" data-tone="warning">
                  {search}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {filteredJobs.length === 0 ? (
              <p className="m-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                {t("admin.dashboard.interactive.emptyFiltered")}
              </p>
            ) : (
              filteredJobs.map((job, index) => (
                <article
                  key={job.id}
                  className={`px-4 py-3 transition hover:bg-slate-50 sm:px-5 ${
                    index === 0 ? "" : "border-t border-slate-100"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2.5 sm:gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="app-chip px-2.5 py-1 text-[11px]" data-tone="info">
                          {formatLocalTime(job.scheduledDateIso)}
                        </span>
                        <span className="font-semibold text-slate-900">{job.customerName}</span>
                      </div>
                      <p className="break-words text-sm text-slate-600">{job.address}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="app-chip px-2.5 py-1 text-[11px]" data-tone={routeStatusTone[job.status]}>
                          {getJobStatusLabel(job.status, t)}
                        </span>
                        <span
                          className="app-chip px-2.5 py-1 text-[11px]"
                          data-tone={job.type === "ON_DEMAND" ? "warning" : "info"}
                        >
                          {job.type === "ON_DEMAND"
                            ? t("jobs.type.onDemand")
                            : t("jobs.type.routine")}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/admin/routes/${job.id}`}
                        className="app-button-ghost px-3 py-1.5 text-xs font-semibold"
                      >
                        {t("common.actions.view")}
                      </Link>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-card p-4 shadow-contrast sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {t("admin.dashboard.progress.title")}
            </h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {t("admin.dashboard.progress.completionRate")}
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="text-2xl font-semibold text-slate-900">{completionRate}%</p>
                  <p className="text-xs text-slate-500">
                    {stats.completedJobs}/{stats.jobsToday}
                  </p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-slate-900 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, completionRate))}%` }}
                  />
                </div>
              </div>
              <p className="app-callout px-4 py-3 text-sm" data-tone="info">
                {t("admin.dashboard.progress.withEvidence", {
                  count: stats.completedWithEvidence,
                  rate: evidenceRate,
                })}
              </p>
              <p className="app-callout px-4 py-3 text-sm" data-tone="warning">
                {t("admin.dashboard.progress.onDemandLoad", {
                  count: stats.onDemandJobs,
                })}
              </p>
            </div>
          </div>

          <div className="app-card p-4 shadow-contrast sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {t("admin.dashboard.recentInvoices.title")}
              </h2>
              <Link
                href="/admin/invoices"
                className="app-button-ghost px-3 py-1.5 text-xs font-semibold"
              >
                {t("admin.dashboard.recentInvoices.viewAll")}
              </Link>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {(
                [
                  { key: "ALL", label: t("admin.dashboard.recentInvoices.filters.all") },
                  {
                    key: "OPEN",
                    label: t("admin.dashboard.recentInvoices.filters.open"),
                  },
                  {
                    key: "PAID",
                    label: t("admin.dashboard.recentInvoices.filters.paid"),
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setInvoiceFilter(item.key)}
                  className={`app-chip shrink-0 px-3 py-1.5 text-xs transition ${
                    invoiceFilter === item.key ? "bg-slate-900 text-white" : ""
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3 text-sm">
              {filteredInvoices.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  {t("admin.dashboard.recentInvoices.emptyFiltered")}
                </p>
              ) : (
                filteredInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={getInvoiceHref(invoice)}
                    className="group block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-sky-200 hover:bg-sky-50/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-slate-900">{invoice.number}</p>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                              invoice.status === "DRAFT"
                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                : invoice.status === "PAID"
                                  ? "border-teal-200 bg-teal-50 text-teal-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {invoiceStatusLabel(invoice.status, t)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{invoice.customerName}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-600">
                          {invoice.status === "DRAFT"
                            ? t("admin.dashboard.recentInvoices.actions.editDraft")
                            : t("admin.dashboard.recentInvoices.actions.viewSent")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          ${invoice.total.toFixed(2)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 transition group-hover:text-slate-600">
                          {invoice.status === "DRAFT"
                            ? t("common.actions.edit")
                            : t("common.actions.view")}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {routeFiltersOpen ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/55 p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={t("common.actions.close")}
            onClick={() => setRouteFiltersOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {t("admin.dashboard.interactive.modalTitle")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t("admin.dashboard.interactive.modalSubtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRouteFiltersOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  aria-label={t("common.actions.close")}
                  title={t("common.actions.close")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-5">
                <section>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("common.actions.search")}
                  </label>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    placeholder={t("admin.dashboard.interactive.searchPlaceholder")}
                  />
                </section>

                <section>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.dashboard.interactive.filtersTitle")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {routeFilterOptions.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setRouteFilter(item.key)}
                        className={`app-chip px-3 py-1.5 text-xs transition ${
                          routeFilter === item.key
                            ? "bg-slate-900 text-white"
                            : ""
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </section>

              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <button
                type="button"
                onClick={resetRouteFilters}
                className="app-button-ghost w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] sm:w-auto"
              >
                {t("admin.dashboard.interactive.reset")}
              </button>
              <button
                type="button"
                onClick={() => setRouteFiltersOpen(false)}
                className="app-button-primary w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] sm:w-auto"
              >
                {t("common.actions.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
