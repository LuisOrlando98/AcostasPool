"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import StatCard from "@/components/ui/StatCard";
import { useI18n } from "@/i18n/client";
import { getJobStatusLabel } from "@/lib/constants";

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
type RouteSort = "TIME" | "CUSTOMER";
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

const invoiceStatusTone: Record<
  DashboardInvoice["status"],
  "info" | "warning" | "success"
> = {
  DRAFT: "info",
  SENT: "warning",
  PAID: "success",
  OVERDUE: "warning",
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
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function AdminDashboardClient({
  jobs,
  invoices,
  stats,
}: AdminDashboardClientProps) {
  const { t } = useI18n();
  const [routeFilter, setRouteFilter] = useState<RouteFilter>("ALL");
  const [routeSort, setRouteSort] = useState<RouteSort>("TIME");
  const [search, setSearch] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>("ALL");

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
      if (routeFilter === "PENDING" && job.status !== "PENDING") return false;
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
      if (routeSort === "CUSTOMER") {
        return a.customerName.localeCompare(b.customerName, undefined, {
          sensitivity: "base",
        });
      }
      return (
        new Date(a.scheduledDateIso).getTime() - new Date(b.scheduledDateIso).getTime()
      );
    });

    return filtered;
  }, [jobs, routeFilter, routeSort, search]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (invoiceFilter === "PAID") return invoice.status === "PAID";
      if (invoiceFilter === "OPEN") return invoice.status !== "PAID";
      return true;
    });
  }, [invoiceFilter, invoices]);

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

      <section className="app-card p-4 shadow-contrast sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            {t("admin.dashboard.quickActions.title")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/routes" className="app-button-secondary px-3 py-2 text-xs">
              {t("admin.dashboard.quickActions.routes")}
            </Link>
            <Link href="/admin/invoices" className="app-button-secondary px-3 py-2 text-xs">
              {t("admin.dashboard.quickActions.invoices")}
            </Link>
            <Link href="/admin/customers" className="app-button-secondary px-3 py-2 text-xs">
              {t("admin.dashboard.quickActions.customers")}
            </Link>
            <Link href="/admin/reports" className="app-button-secondary px-3 py-2 text-xs">
              {t("admin.dashboard.quickActions.reports")}
            </Link>
          </div>
        </div>
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
              <Link
                href="/admin/routes"
                className="app-button-ghost px-3 py-1.5 text-xs font-semibold"
              >
                {t("admin.dashboard.todayRoute.viewAll")}
              </Link>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="app-input w-full px-4 py-3 text-sm"
              placeholder={t("admin.dashboard.interactive.searchPlaceholder")}
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.dashboard.interactive.sortLabel")}
              </span>
              <button
                type="button"
                onClick={() => setRouteSort("TIME")}
                className={`app-button-ghost px-3 py-1.5 text-xs font-semibold ${
                  routeSort === "TIME" ? "bg-slate-100 text-slate-900" : ""
                }`}
              >
                {t("admin.dashboard.interactive.sortTime")}
              </button>
              <button
                type="button"
                onClick={() => setRouteSort("CUSTOMER")}
                className={`app-button-ghost px-3 py-1.5 text-xs font-semibold ${
                  routeSort === "CUSTOMER" ? "bg-slate-100 text-slate-900" : ""
                }`}
              >
                {t("admin.dashboard.interactive.sortCustomer")}
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {(
                [
                  { key: "ALL", label: t("admin.dashboard.interactive.filters.all") },
                  {
                    key: "PENDING",
                    label: t("admin.dashboard.interactive.filters.pending"),
                  },
                  {
                    key: "IN_PROGRESS",
                    label: t("admin.dashboard.interactive.filters.inProgress"),
                  },
                  {
                    key: "COMPLETED",
                    label: t("admin.dashboard.interactive.filters.completed"),
                  },
                  {
                    key: "ON_DEMAND",
                    label: t("admin.dashboard.interactive.filters.onDemand"),
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setRouteFilter(item.key)}
                  className={`app-chip shrink-0 px-3 py-1.5 text-xs transition ${
                    routeFilter === item.key ? "bg-slate-900 text-white" : ""
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {filteredJobs.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                {t("admin.dashboard.interactive.emptyFiltered")}
              </p>
            ) : (
              filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="app-callout rounded-2xl px-4 py-3 sm:px-5"
                  data-tone={routeStatusTone[job.status]}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold text-slate-900">
                        {job.customerName}
                      </p>
                      <p className="break-words text-sm text-slate-600">{job.address}</p>
                      <p className="text-xs text-slate-500">
                        {formatLocalTime(job.scheduledDateIso)} -{" "}
                        {getJobStatusLabel(job.status, t)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className="app-chip px-3 py-1 text-[11px]"
                        data-tone={job.type === "ON_DEMAND" ? "warning" : "info"}
                      >
                        {job.type === "ON_DEMAND"
                          ? t("jobs.type.onDemand")
                          : t("jobs.type.routine")}
                      </span>
                      <Link
                        href={`/admin/routes/${job.id}`}
                        className="app-button-ghost px-3 py-1.5 text-xs font-semibold"
                      >
                        {t("common.actions.view")}
                      </Link>
                    </div>
                  </div>
                </div>
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
                  <div
                    key={invoice.id}
                    className="app-callout flex items-start justify-between gap-3 rounded-2xl px-4 py-3"
                    data-tone={invoiceStatusTone[invoice.status]}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{invoice.number}</p>
                      <p className="truncate text-xs text-slate-500">{invoice.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        ${invoice.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {invoiceStatusLabel(invoice.status, t)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
