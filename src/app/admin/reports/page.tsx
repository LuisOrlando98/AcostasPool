import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { JOB_STATUSES, JOB_STATUS_KEYS, JOB_TYPES } from "@/lib/constants";
import { unstable_cache } from "next/cache";
import {
  buildJobWhere,
  buildQueryParams,
  formatDateInput,
  getReportFilters,
  type ReportFilters,
} from "@/lib/reports/filters";

type ReportsPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

const getReportSnapshot = (filtersKey: string, filters: ReportFilters) =>
  unstable_cache(
    async () => {
      const jobWhere = buildJobWhere(filters);

      const [
        technicians,
        jobs,
        jobsWithEvidence,
        customerRequests,
        reschedules,
      ] = await Promise.all([
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
            completedAt: true,
          },
        }),
        prisma.job.count({
          where: { ...jobWhere, status: "COMPLETED", photos: { some: {} } },
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
            recipientRole: "ADMIN",
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
        scheduledDate: Date;
        completedAt: Date | null;
      }[] = [];
      for (const job of jobs) {
        jobStatusMap.set(job.status, (jobStatusMap.get(job.status) ?? 0) + 1);
        jobTypeMap.set(job.type, (jobTypeMap.get(job.type) ?? 0) + 1);
        serviceMap.set(
          job.serviceType,
          (serviceMap.get(job.serviceType) ?? 0) + 1
        );
        priorityMap.set(
          job.priority,
          (priorityMap.get(job.priority) ?? 0) + 1
        );
        customerMap.set(
          job.customerId,
          (customerMap.get(job.customerId) ?? 0) + 1
        );
        const techKey = job.technicianId ?? "unassigned";
        const statusKey = job.status;
        const statusMap =
          technicianStatMap.get(techKey) ?? new Map<string, number>();
        statusMap.set(statusKey, (statusMap.get(statusKey) ?? 0) + 1);
        technicianStatMap.set(techKey, statusMap);
        if (job.status === "COMPLETED") {
          completedJobs.push({
            scheduledDate: job.scheduledDate,
            completedAt: job.completedAt,
          });
        }
      }

      const jobStatusGroups = [...jobStatusMap.entries()].map(
        ([status, count]) => ({
          status,
          _count: { _all: count },
        })
      );
      const jobTypeGroups = [...jobTypeMap.entries()].map(([type, count]) => ({
        type,
        _count: { _all: count },
      }));
      const serviceGroups = [...serviceMap.entries()].map(
        ([serviceType, count]) => ({
          serviceType,
          _count: { _all: count },
        })
      );
      const priorityGroups = [...priorityMap.entries()].map(
        ([priority, count]) => ({
          priority,
          _count: { _all: count },
        })
      );
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
        jobsWithEvidence,
        customerRequests,
        reschedules,
        topCustomers,
        topCustomerRecords,
        technicianStats,
      };
    },
    ["reports", filtersKey],
    { revalidate: 60 }
  )();

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const filters = getReportFilters(resolvedSearchParams);
  const filtersKey = buildQueryParams(filters);
  const logsPageRaw = resolvedSearchParams?.logsPage;
  const requestedLogsPage = Array.isArray(logsPageRaw)
    ? Number(logsPageRaw[0])
    : Number(logsPageRaw);
  const logsPageSize = 15;

  const logsWhere = {
    createdAt: { gte: filters.from, lte: filters.to },
  };

  const [snapshot, logsTotal] = await Promise.all([
    getReportSnapshot(filtersKey, filters),
    prisma.emailLog.count({ where: logsWhere }),
  ]);

  const logsTotalPages = Math.max(1, Math.ceil(logsTotal / logsPageSize));
  const logsPage =
    Number.isFinite(requestedLogsPage) && requestedLogsPage > 0
      ? Math.min(requestedLogsPage, logsTotalPages)
      : 1;
  const logsSkip = (logsPage - 1) * logsPageSize;

  const logs = await prisma.emailLog.findMany({
    where: logsWhere,
    orderBy: { createdAt: "desc" },
    skip: logsSkip,
    take: logsPageSize,
    include: {
      customer: true,
      technician: { include: { user: true } },
      job: { include: { property: true } },
      digest: true,
    },
  });

  const {
    technicians,
    jobStatusGroups,
    jobTypeGroups,
    serviceGroups,
    priorityGroups,
    completedJobs,
    jobsWithEvidence,
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
  const evidenceRate = completedCount
    ? Math.round((jobsWithEvidence / completedCount) * 100)
    : 0;

  const avgCompletionDelayMinutes = (() => {
    if (completedJobs.length === 0) {
      return 0;
    }
    const totalMinutes = completedJobs.reduce((sum, job) => {
      if (!job.completedAt) {
        return sum;
      }
      const diff = job.completedAt.getTime() - job.scheduledDate.getTime();
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
  const buildLogsHref = (page: number) => {
    const params = new URLSearchParams(queryParams);
    if (page > 1) {
      params.set("logsPage", String(page));
    } else {
      params.delete("logsPage");
    }
    const query = params.toString();
    return query ? `/admin/reports?${query}` : "/admin/reports";
  };

  const statusLabel = (status: string) =>
    t(JOB_STATUS_KEYS[status as keyof typeof JOB_STATUS_KEYS] ?? status);

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
      <section className="ui-panel p-5 shadow-contrast">
        <form className="ui-filter-bar flex flex-wrap gap-3" method="get">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t("admin.reports.filters.range")}
            </div>
            {(["7", "30", "90"] as const).map((range) => (
              <button
                key={range}
                type="submit"
                name="range"
                value={range}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  filters.range === range
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                {t(`admin.reports.filters.range${range}`)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              name="from"
              defaultValue={formatDateInput(filters.from)}
              className="app-input px-3 py-2 text-sm"
            />
            <input
              type="date"
              name="to"
              defaultValue={formatDateInput(filters.to)}
              className="app-input px-3 py-2 text-sm"
            />
            <select
              name="technicianId"
              defaultValue={filters.technicianId ?? ""}
              className="app-input bg-white px-3 py-2 text-sm"
            >
              <option value="">{t("admin.reports.filters.allTechs")}</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.user.fullName}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="app-input bg-white px-3 py-2 text-sm"
            >
              <option value="">{t("admin.reports.filters.allStatuses")}</option>
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <select
              name="type"
              defaultValue={filters.type ?? ""}
              className="app-input bg-white px-3 py-2 text-sm"
            >
              <option value="">{t("admin.reports.filters.allTypes")}</option>
              {JOB_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "ON_DEMAND"
                    ? t("jobs.type.onDemand")
                    : t("jobs.type.routine")}
                </option>
              ))}
            </select>
            <select
              name="serviceType"
              defaultValue={filters.serviceType ?? ""}
              className="app-input bg-white px-3 py-2 text-sm"
            >
              <option value="">{t("admin.reports.filters.allServices")}</option>
              <option value="WEEKLY_CLEANING">
                {t("jobs.service.weeklyCleaning")}
              </option>
              <option value="FILTER_CHECK">
                {t("jobs.service.filterCheck")}
              </option>
              <option value="CHEM_BALANCE">
                {t("jobs.service.chemBalance")}
              </option>
              <option value="EQUIPMENT_CHECK">
                {t("jobs.service.equipmentCheck")}
              </option>
            </select>
            <select
              name="priority"
              defaultValue={filters.priority ?? ""}
              className="app-input bg-white px-3 py-2 text-sm"
            >
              <option value="">
                {t("admin.reports.filters.allPriorities")}
              </option>
              <option value="NORMAL">{t("jobs.priority.normal")}</option>
              <option value="URGENT">{t("jobs.priority.urgent")}</option>
            </select>
            <button
              type="submit"
              className="app-button-primary px-4 py-2 text-sm font-semibold"
            >
              {t("admin.reports.filters.apply")}
            </button>
            <a
              href="/admin/reports"
              className="app-button-secondary px-4 py-2 text-sm font-semibold"
            >
              {t("admin.reports.filters.reset")}
            </a>
          </div>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
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
          label={t("admin.reports.cards.evidenceRate")}
          value={`${evidenceRate}%`}
          helper={`${jobsWithEvidence} ${t("admin.reports.cards.withEvidence")}`}
          tone="info"
        />
        <StatCard
          label={t("admin.reports.cards.avgDelay")}
          value={`${avgCompletionDelayMinutes}m`}
          helper={t("admin.reports.cards.avgDelayHelper")}
          tone="warning"
        />
        <StatCard
          label={t("admin.reports.cards.reschedules")}
          value={reschedules.toString()}
          helper={t("admin.reports.cards.reschedulesHelper")}
          tone="warning"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="app-card p-6 shadow-contrast">
          <div className="flex items-center justify-between">
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

        <div className="space-y-6">
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
        </div>
      </section>

      <section className="grid gap-6">
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

      <section className="app-card p-6 shadow-contrast">
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
        </div>

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

