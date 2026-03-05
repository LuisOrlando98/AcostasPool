import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import ReportsFiltersBar from "@/components/reports/ReportsFiltersBar";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildJobWhere,
  buildQueryParams,
  formatDateInput,
  getReportFilters,
  type ReportFilters,
} from "@/lib/reports/filters";

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type LogsFilters = {
  query: string;
  status: "ALL" | "QUEUED" | "SENT" | "FAILED";
};

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLogsStatus(value: string): LogsFilters["status"] {
  const upper = value.toUpperCase();
  if (upper === "QUEUED" || upper === "SENT" || upper === "FAILED") {
    return upper;
  }
  return "ALL";
}

async function clearEmailLogsAction(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const filters = getReportFilters({
    from: readFormString(formData, "from") || undefined,
    to: readFormString(formData, "to") || undefined,
    range: readFormString(formData, "range") || undefined,
    technicianId: readFormString(formData, "technicianId") || undefined,
    serviceType: readFormString(formData, "serviceType") || undefined,
    priority: readFormString(formData, "priority") || undefined,
  });
  const logsFilters: LogsFilters = {
    query: readFormString(formData, "logsQ"),
    status: normalizeLogsStatus(readFormString(formData, "logsStatus")),
  };

  const result = await prisma.emailLog.deleteMany({
    where: buildLogsWhere(filters, logsFilters),
  });

  revalidatePath("/admin/reports");

  const params = new URLSearchParams();
  params.set("from", formatDateInput(filters.from));
  params.set("to", formatDateInput(filters.to));
  if (filters.range && filters.range !== "custom") {
    params.set("range", filters.range);
  }
  if (filters.technicianId) {
    params.set("technicianId", filters.technicianId);
  }
  if (filters.serviceType) {
    params.set("serviceType", filters.serviceType);
  }
  if (filters.priority) {
    params.set("priority", filters.priority);
  }
  if (logsFilters.query) {
    params.set("logsQ", logsFilters.query);
  }
  if (logsFilters.status !== "ALL") {
    params.set("logsStatus", logsFilters.status);
  }
  params.set("logsCleared", String(result.count));
  redirect(`/admin/reports?${params.toString()}`);
}

async function getReportSnapshot(filters: ReportFilters) {
  const jobWhere = buildJobWhere(filters);

  const [technicians, jobs, customerRequests, reschedules] =
    await Promise.all([
      prisma.technician.findMany({
        include: { user: true },
        orderBy: { user: { fullName: "asc" } },
      }),
      prisma.job.findMany({
        where: jobWhere,
        select: {
          status: true,
          type: true,
          serviceType: true,
          priority: true,
          customerId: true,
          technicianId: true,
          scheduledDate: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.notification.count({
        where: {
          eventType: "CUSTOMER_REQUEST",
          recipientRole: "ADMIN",
          createdAt: { gte: filters.from, lte: filters.to },
        },
      }),
      prisma.notification.count({
        where: {
          eventType: "SERVICE_RESCHEDULED",
          recipientRole: "CUSTOMER",
          createdAt: { gte: filters.from, lte: filters.to },
        },
      }),
    ]);

  const jobStatusMap = new Map<string, number>();
  const jobTypeMap = new Map<string, number>();
  const serviceMap = new Map<string, number>();
  const priorityMap = new Map<string, number>();
  const customerMap = new Map<string, number>();
  const technicianStatMap = new Map<string, Map<string, number>>();

  const completedJobs: {
    startedAt: Date | null;
    completedAt: Date | null;
  }[] = [];
  for (const job of jobs) {
    jobStatusMap.set(job.status, (jobStatusMap.get(job.status) ?? 0) + 1);
    jobTypeMap.set(job.type, (jobTypeMap.get(job.type) ?? 0) + 1);
    serviceMap.set(job.serviceType, (serviceMap.get(job.serviceType) ?? 0) + 1);
    priorityMap.set(job.priority, (priorityMap.get(job.priority) ?? 0) + 1);
    customerMap.set(job.customerId, (customerMap.get(job.customerId) ?? 0) + 1);

    const techKey = job.technicianId ?? "unassigned";
    const statusKey = job.status;
    const statusMap = technicianStatMap.get(techKey) ?? new Map<string, number>();
    statusMap.set(statusKey, (statusMap.get(statusKey) ?? 0) + 1);
    technicianStatMap.set(techKey, statusMap);

    if (job.status === "COMPLETED") {
      completedJobs.push({
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      });
    }
  }

  const jobStatusGroups = [...jobStatusMap.entries()].map(([status, count]) => ({
    status,
    _count: { _all: count },
  }));
  const jobTypeGroups = [...jobTypeMap.entries()].map(([type, count]) => ({
    type,
    _count: { _all: count },
  }));
  const serviceGroups = [...serviceMap.entries()].map(([serviceType, count]) => ({
    serviceType,
    _count: { _all: count },
  }));
  const priorityGroups = [...priorityMap.entries()].map(([priority, count]) => ({
    priority,
    _count: { _all: count },
  }));
  const topCustomers = [...customerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([customerId, count]) => ({
      customerId,
      _count: { _all: count },
    }));
  const technicianStats = [...technicianStatMap.entries()].flatMap(
    ([technicianId, statusMap]) =>
      [...statusMap.entries()].map(([status, count]) => ({
        technicianId: technicianId === "unassigned" ? null : technicianId,
        status,
        _count: { _all: count },
      }))
  );

  const topCustomerRecords =
    topCustomers.length > 0
      ? await prisma.customer.findMany({
          where: {
            id: { in: topCustomers.map((item) => item.customerId) },
          },
        })
      : [];

  return {
    technicians,
    jobStatusGroups,
    jobTypeGroups,
    serviceGroups,
    priorityGroups,
    completedJobs,
    customerRequests,
    reschedules,
    topCustomers,
    topCustomerRecords,
    technicianStats,
  };
}

function buildLogsWhere(filters: ReportFilters, logsFilters: LogsFilters) {
  const query = logsFilters.query.trim();
  const where: Prisma.EmailLogWhereInput = {
    createdAt: { gte: filters.from, lte: filters.to },
    ...(logsFilters.status !== "ALL" ? { status: logsFilters.status } : {}),
    ...(query
      ? {
          OR: [
            {
              recipientName: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              recipientEmail: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              customer: {
                is: {
                  nombre: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              customer: {
                is: {
                  apellidos: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
  return where;
}

async function getLogsTotal(filters: ReportFilters, logsFilters: LogsFilters) {
  return prisma.emailLog.count({
    where: buildLogsWhere(filters, logsFilters),
  });
}

async function getLogsPageData(
  filters: ReportFilters,
  logsFilters: LogsFilters,
  page: number,
  pageSize: number
) {
  const where = buildLogsWhere(filters, logsFilters);

  try {
    return await prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: true,
        technician: { include: { user: true } },
        job: { include: { property: true } },
        digest: true,
      },
    });
  } catch (error) {
    console.error("Reports logs query failed:", error);
    return [];
  }
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const readParam = (key: string) => {
    const value = resolvedSearchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const filters = getReportFilters(resolvedSearchParams);
  const logsQuery = (readParam("logsQ") ?? "").trim();
  const logsStatusRaw = (readParam("logsStatus") ?? "ALL").toUpperCase();
  const logsStatus = normalizeLogsStatus(logsStatusRaw);
  const logsClearedRaw = readParam("logsCleared");
  const logsCleared = Number(logsClearedRaw);
  const hasLogsClearedParam = Boolean(logsClearedRaw);
  const logsFilters: LogsFilters = {
    query: logsQuery,
    status: logsStatus,
  };
  const logsPageRaw = resolvedSearchParams?.logsPage;
  const requestedLogsPage = Array.isArray(logsPageRaw)
    ? Number(logsPageRaw[0])
    : Number(logsPageRaw);
  const logsPageSize = 15;
  const emptySnapshot = {
    technicians: [] as Awaited<ReturnType<typeof prisma.technician.findMany>>,
    jobStatusGroups: [] as Array<{ status: string; _count: { _all: number } }>,
    jobTypeGroups: [] as Array<{ type: string; _count: { _all: number } }>,
    serviceGroups: [] as Array<{ serviceType: string; _count: { _all: number } }>,
    priorityGroups: [] as Array<{ priority: string; _count: { _all: number } }>,
    completedJobs: [] as Array<{ startedAt: Date | null; completedAt: Date | null }>,
    customerRequests: 0,
    reschedules: 0,
    topCustomers: [] as Array<{ customerId: string; _count: { _all: number } }>,
    topCustomerRecords: [] as Awaited<ReturnType<typeof prisma.customer.findMany>>,
    technicianStats: [] as Array<{
      technicianId: string | null;
      status: string;
      _count: { _all: number };
    }>,
  };

  let snapshot = emptySnapshot;
  let logsTotal = 0;

  try {
    [snapshot, logsTotal] = await Promise.all([
      getReportSnapshot(filters),
      getLogsTotal(filters, logsFilters),
    ]);
  } catch (error) {
    console.error("Reports dashboard query failed:", error);
  }

  const logsTotalPages = Math.max(1, Math.ceil(logsTotal / logsPageSize));
  const logsPage =
    Number.isFinite(requestedLogsPage) && requestedLogsPage > 0
      ? Math.min(requestedLogsPage, logsTotalPages)
      : 1;
  const logs = await getLogsPageData(filters, logsFilters, logsPage, logsPageSize);

  const {
    technicians,
    jobStatusGroups,
    jobTypeGroups,
    serviceGroups,
    priorityGroups,
    completedJobs,
    customerRequests,
    reschedules,
    topCustomers,
    topCustomerRecords,
    technicianStats,
  } = snapshot;

  const totalJobs = jobStatusGroups.reduce(
    (sum, entry) => sum + entry._count._all,
    0
  );
  const completedCount =
    jobStatusGroups.find((entry) => entry.status === "COMPLETED")?._count._all ??
    0;
  const pendingCount = totalJobs - completedCount;
  const onDemandCount =
    jobTypeGroups.find((entry) => entry.type === "ON_DEMAND")?._count._all ?? 0;
  const completionRate = totalJobs
    ? Math.round((completedCount / totalJobs) * 100)
    : 0;
  const avgCompletionTimeMinutes = (() => {
    if (completedJobs.length === 0) {
      return 0;
    }
    const totalMinutes = completedJobs.reduce((sum, job) => {
      if (!job.startedAt || !job.completedAt) {
        return sum;
      }
      const diff = job.completedAt.getTime() - job.startedAt.getTime();
      return sum + Math.max(diff / 60000, 0);
    }, 0);
    return Math.round(totalMinutes / completedJobs.length);
  })();

  const technicianMap = new Map(
    technicians.map((tech) => [tech.id, tech.user.fullName])
  );
  const techRows = new Map<
    string,
    { name: string; total: number; completed: number; pending: number }
  >();
  for (const entry of technicianStats) {
    const techId = entry.technicianId ?? "unassigned";
    const name =
      techId === "unassigned"
        ? t("admin.reports.technicians.unassigned")
        : technicianMap.get(techId) ?? t("admin.reports.technicians.unknown");
    const existing =
      techRows.get(techId) ?? { name, total: 0, completed: 0, pending: 0 };
    existing.total += entry._count._all;
    if (entry.status === "COMPLETED") {
      existing.completed += entry._count._all;
    } else {
      existing.pending += entry._count._all;
    }
    techRows.set(techId, existing);
  }

  const customerMap = new Map(
    topCustomerRecords.map((customer) => [customer.id, customer])
  );

  const queryParams = buildQueryParams(filters);
  const logsActiveFiltersCount = [
    logsFilters.query.length > 0,
    logsFilters.status !== "ALL",
  ].filter(Boolean).length;
  const smtpMissingKeys = [
    ["SMTP_HOST", process.env.SMTP_HOST],
    ["SMTP_USER", process.env.SMTP_USER],
    ["SMTP_PASS", process.env.SMTP_PASS],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  const smtpConfigured = smtpMissingKeys.length === 0;

  const buildReportsHref = (options?: {
    logsPage?: number;
    logsQ?: string;
    logsStatus?: LogsFilters["status"];
  }) => {
    const params = new URLSearchParams(queryParams);
    const nextLogsQ = options?.logsQ ?? logsFilters.query;
    const nextLogsStatus = options?.logsStatus ?? logsFilters.status;
    const nextLogsPage = options?.logsPage ?? logsPage;

    if (nextLogsQ) {
      params.set("logsQ", nextLogsQ);
    } else {
      params.delete("logsQ");
    }

    if (nextLogsStatus !== "ALL") {
      params.set("logsStatus", nextLogsStatus);
    } else {
      params.delete("logsStatus");
    }

    if (nextLogsPage > 1) {
      params.set("logsPage", String(nextLogsPage));
    } else {
      params.delete("logsPage");
    }

    const query = params.toString();
    return query ? `/admin/reports?${query}` : "/admin/reports";
  };

  const buildLogsHref = (page: number) => {
    return buildReportsHref({ logsPage: page });
  };

  const serviceLabelMap: Record<string, string> = {
    WEEKLY_CLEANING: t("jobs.service.weeklyCleaning"),
    FILTER_CHECK: t("jobs.service.filterCheck"),
    CHEM_BALANCE: t("jobs.service.chemBalance"),
    EQUIPMENT_CHECK: t("jobs.service.equipmentCheck"),
  };
  const notAvailableLabel = t("common.labels.notAvailable");

  return (
    <AppShell
      title={t("admin.reports.title")}
      subtitle={t("admin.reports.subtitle")}
      role="ADMIN"
    >
      <ReportsFiltersBar
        technicians={technicians.map((tech) => ({
          id: tech.id,
          name: tech.user.fullName,
        }))}
        defaults={{
          range: filters.range,
          from: formatDateInput(filters.from),
          to: formatDateInput(filters.to),
          technicianId: filters.technicianId,
          serviceType: filters.serviceType,
          priority: filters.priority,
        }}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={t("admin.reports.cards.totalJobs")}
          value={totalJobs.toString()}
          helper={`${completedCount} ${t("admin.reports.cards.completed")}`}
          tone="info"
        />
        <StatCard
          label={t("admin.reports.cards.completionRate")}
          value={`${completionRate}%`}
          helper={`${pendingCount} ${t("admin.reports.cards.pending")}`}
          tone="success"
        />
        <StatCard
          label={t("admin.reports.cards.onDemand")}
          value={onDemandCount.toString()}
          helper={`${customerRequests} ${t("admin.reports.cards.requests")}`}
          tone="warning"
        />
        <StatCard
          label={t("admin.reports.cards.avgCompletionTime")}
          value={`${avgCompletionTimeMinutes}m`}
          helper={t("admin.reports.cards.avgCompletionTimeHelper")}
          tone="warning"
        />
        <StatCard
          label={t("admin.reports.cards.reschedules")}
          value={reschedules.toString()}
          helper={t("admin.reports.cards.reschedulesHelper")}
          tone="warning"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="app-card p-6 shadow-contrast">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {t("admin.reports.technicians.title")}
            </h2>
            <a
              href={`/api/reports/export?type=jobs&${queryParams}`}
              className="app-button-secondary px-3 py-2 text-xs font-semibold"
            >
              {t("admin.reports.exports.jobs")}
            </a>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {[...techRows.values()].length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.reports.technicians.empty")}
              </p>
            ) : (
              [...techRows.values()].map((row) => (
                <div
                  key={row.name}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.completed} {t("admin.reports.technicians.completed")} -{" "}
                      {row.pending} {t("admin.reports.technicians.pending")}
                    </p>
                  </div>
                  <Badge
                    label={`${Math.round(
                      row.total ? (row.completed / row.total) * 100 : 0
                    )}%`}
                    tone="success"
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="app-card p-6 shadow-contrast">
          <h2 className="text-lg font-semibold">
            {t("admin.reports.customers.title")}
          </h2>
          <div className="mt-4 space-y-2 text-sm">
            {topCustomers.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.reports.customers.empty")}
              </p>
            ) : (
              topCustomers.map((entry) => {
                const customer = customerMap.get(entry.customerId);
                return (
                  <div
                    key={entry.customerId}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <span>
                      {customer
                        ? formatCustomerName(customer)
                        : notAvailableLabel}
                    </span>
                    <Badge label={entry._count._all.toString()} tone="info" />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="app-card p-6 shadow-contrast">
          <h2 className="text-lg font-semibold">
            {t("admin.reports.services.title")}
          </h2>
          <div className="mt-4 space-y-2 text-sm">
            {serviceGroups.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.reports.services.empty")}
              </p>
            ) : (
              serviceGroups.map((item) => (
                <div
                  key={item.serviceType ?? "unknown"}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span>
                    {item.serviceType
                      ? serviceLabelMap[item.serviceType] ?? item.serviceType
                      : notAvailableLabel}
                  </span>
                  <Badge
                    label={item._count._all.toString()}
                    tone="info"
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="app-card p-6 shadow-contrast">
          <h2 className="text-lg font-semibold">
            {t("admin.reports.priorities.title")}
          </h2>
          <div className="mt-4 space-y-2 text-sm">
            {priorityGroups.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.reports.priorities.empty")}
              </p>
            ) : (
              priorityGroups.map((item) => (
                <div
                  key={item.priority ?? "unknown"}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span>
                    {item.priority === "URGENT"
                      ? t("jobs.priority.urgent")
                      : item.priority === "NORMAL"
                        ? t("jobs.priority.normal")
                        : notAvailableLabel}
                  </span>
                  <Badge label={item._count._all.toString()} tone="warning" />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="app-card overflow-visible p-6 shadow-contrast">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {t("admin.reports.emails.title")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("admin.reports.emails.count", {
                count: logs.length,
                total: logsTotal,
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              label={
                smtpConfigured
                  ? t("admin.reports.emails.smtp.ok")
                  : t("admin.reports.emails.smtp.missing")
              }
              tone={smtpConfigured ? "success" : "warning"}
            />
            {logsActiveFiltersCount > 0 ? (
              <span className="app-chip px-3 py-1 text-xs" data-tone="warning">
                {t("admin.reports.emails.filters.activeCount", {
                  count: logsActiveFiltersCount,
                })}
              </span>
            ) : null}
            <details className="relative">
              <summary className="no-marker app-button-ghost inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full p-0">
                <span className="sr-only">{t("admin.reports.emails.filters.open")}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
                </svg>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-[min(92vw,22rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:p-4">
                <form method="get" action="/admin/reports" className="space-y-3">
                  <input type="hidden" name="from" value={formatDateInput(filters.from)} />
                  <input type="hidden" name="to" value={formatDateInput(filters.to)} />
                  {filters.range && filters.range !== "custom" ? (
                    <input type="hidden" name="range" value={filters.range} />
                  ) : null}
                  {filters.technicianId ? (
                    <input
                      type="hidden"
                      name="technicianId"
                      value={filters.technicianId}
                    />
                  ) : null}
                  {filters.serviceType ? (
                    <input
                      type="hidden"
                      name="serviceType"
                      value={filters.serviceType}
                    />
                  ) : null}
                  {filters.priority ? (
                    <input type="hidden" name="priority" value={filters.priority} />
                  ) : null}

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {t("common.actions.search")}
                    </label>
                    <input
                      name="logsQ"
                      defaultValue={logsFilters.query}
                      className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                      placeholder={t("admin.reports.emails.filters.placeholder")}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {t("admin.reports.emails.filters.status")}
                    </label>
                    <select
                      name="logsStatus"
                      defaultValue={logsFilters.status}
                      className="app-input mt-1.5 w-full bg-white px-3 py-2 text-sm"
                    >
                      <option value="ALL">{t("admin.reports.emails.filters.allStatuses")}</option>
                      <option value="QUEUED">{t("admin.reports.emails.filters.queued")}</option>
                      <option value="SENT">{t("admin.reports.emails.filters.sent")}</option>
                      <option value="FAILED">{t("admin.reports.emails.filters.failed")}</option>
                    </select>
                  </div>
                  <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
                    <a
                      href={buildReportsHref({
                        logsPage: 1,
                        logsQ: "",
                        logsStatus: "ALL",
                      })}
                      className="app-button-ghost px-3 py-2 text-center text-xs font-semibold"
                    >
                      {t("admin.reports.emails.filters.clear")}
                    </a>
                    <button
                      type="submit"
                      className="app-button-primary px-3 py-2 text-xs font-semibold"
                    >
                      {t("admin.reports.emails.filters.apply")}
                    </button>
                  </div>
                </form>
                <form action={clearEmailLogsAction} className="mt-3 border-t border-slate-100 pt-3">
                  <input type="hidden" name="from" value={formatDateInput(filters.from)} />
                  <input type="hidden" name="to" value={formatDateInput(filters.to)} />
                  <input type="hidden" name="range" value={filters.range} />
                  {filters.technicianId ? (
                    <input type="hidden" name="technicianId" value={filters.technicianId} />
                  ) : null}
                  {filters.serviceType ? (
                    <input type="hidden" name="serviceType" value={filters.serviceType} />
                  ) : null}
                  {filters.priority ? (
                    <input type="hidden" name="priority" value={filters.priority} />
                  ) : null}
                  <input type="hidden" name="logsQ" value={logsFilters.query} />
                  <input type="hidden" name="logsStatus" value={logsFilters.status} />
                  <button
                    type="submit"
                    className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    {t("admin.reports.emails.actions.clearFiltered")}
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>

        {!smtpConfigured ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t("admin.reports.emails.smtp.help", {
              keys: smtpMissingKeys.join(", "),
            })}
          </div>
        ) : null}
        {hasLogsClearedParam ? (
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            {logsCleared > 0
              ? t("admin.reports.emails.actions.cleared", {
                  count: String(logsCleared),
                })
              : t("admin.reports.emails.actions.noneToClear")}
          </div>
        ) : null}

        <div className="mt-4 space-y-3 text-sm">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("admin.reports.emails.empty")}
            </p>
          ) : (
            logs.map((log) => {
              const recipientName =
                log.recipientName ||
                (log.customer ? formatCustomerName(log.customer) : null) ||
                log.technician?.user.fullName ||
                t("admin.reports.emails.recipientFallback");
              const statusTone =
                log.status === "SENT"
                  ? "success"
                  : log.status === "FAILED"
                    ? "warning"
                    : "neutral";
              return (
                <details
                  key={log.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <summary className="no-marker cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {recipientName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {log.recipientEmail} - {log.subject}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge label={log.status} tone={statusTone} />
                        <span>
                          {log.sentAt
                            ? log.sentAt.toLocaleString(locale)
                            : log.createdAt.toLocaleString(locale)}
                        </span>
                      </div>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <p className="uppercase tracking-wider text-[10px] text-slate-400">
                          {t("admin.reports.emails.fields.role")}
                        </p>
                        <p>{log.recipientRole}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wider text-[10px] text-slate-400">
                          {t("admin.reports.emails.fields.job")}
                        </p>
                        <p>
                          {log.job?.property?.address ??
                            t("admin.reports.emails.noJob")}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wider text-[10px] text-slate-400">
                          {t("admin.reports.emails.fields.digest")}
                        </p>
                        <p>{log.digest?.window ?? notAvailableLabel}</p>
                      </div>
                    </div>
                    {log.errorMessage ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-600">
                        {log.errorMessage}
                      </div>
                    ) : null}
                    <div>
                      <p className="uppercase tracking-wider text-[10px] text-slate-400">
                        {t("admin.reports.emails.fields.content")}
                      </p>
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                        {log.bodyText}
                      </pre>
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </div>

        {logsTotalPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              {t("admin.reports.emails.page", {
                page: logsPage,
                total: logsTotalPages,
              })}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={buildLogsHref(Math.max(1, logsPage - 1))}
                className={`rounded-full border px-3 py-1 font-semibold ${
                  logsPage === 1
                    ? "pointer-events-none border-slate-100 text-slate-300"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {t("admin.reports.emails.prev")}
              </a>
              <a
                href={buildLogsHref(Math.min(logsTotalPages, logsPage + 1))}
                className={`rounded-full border px-3 py-1 font-semibold ${
                  logsPage === logsTotalPages
                    ? "pointer-events-none border-slate-100 text-slate-300"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {t("admin.reports.emails.next")}
              </a>
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

