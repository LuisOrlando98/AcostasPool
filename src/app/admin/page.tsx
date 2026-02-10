import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { getJobStatusLabel } from "@/lib/constants";
import { formatCustomerName } from "@/lib/customers/format";
import { getTranslations } from "@/i18n/server";

export default async function AdminPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const [jobsToday, pendingJobs, completedJobs, invoices, customers] =
    await Promise.all([
      prisma.job.findMany({
        where: { scheduledDate: { gte: startOfDay, lte: endOfDay } },
        select: {
          id: true,
          scheduledDate: true,
          status: true,
          type: true,
          customer: { select: { nombre: true, apellidos: true, email: true } },
          property: { select: { address: true } },
        },
      }),
      prisma.job.count({
        where: {
          scheduledDate: { gte: startOfDay, lte: endOfDay },
          status: { in: ["PENDING", "ON_THE_WAY", "IN_PROGRESS"] },
        },
      }),
      prisma.job.count({
        where: {
          scheduledDate: { gte: startOfDay, lte: endOfDay },
          status: "COMPLETED",
        },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          number: true,
          total: true,
          status: true,
          customer: { select: { nombre: true, apellidos: true, email: true } },
        },
      }),
      prisma.customer.count(),
    ]);

  return (
    <AppShell
      title={t("admin.dashboard.title")}
      subtitle={t("admin.dashboard.subtitle")}
      role="ADMIN"
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("admin.dashboard.stats.jobsToday")}
          value={`${jobsToday.length}`}
          helper={t("admin.dashboard.stats.inRoute")}
          tone="info"
        />
        <StatCard
          label={t("admin.dashboard.stats.pending")}
          value={`${pendingJobs}`}
          helper={t("admin.dashboard.stats.pendingToday")}
          tone="warning"
        />
        <StatCard
          label={t("admin.dashboard.stats.completed")}
          value={`${completedJobs}`}
          helper={t("admin.dashboard.stats.withEvidence")}
          tone="success"
        />
        <StatCard
          label={t("admin.dashboard.stats.customers")}
          value={`${customers}`}
          helper={t("admin.dashboard.stats.activeBase")}
          tone="info"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="app-card p-6 shadow-contrast">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t("admin.dashboard.todayRoute.title")}
            </h2>
            <span className="app-chip px-3 py-1 text-xs" data-tone="info">
              {t("admin.dashboard.todayRoute.count", {
                count: jobsToday.length,
              })}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {jobsToday.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.dashboard.todayRoute.empty")}
              </p>
            ) : (
              jobsToday.map((job) => (
                <div
                  key={job.id}
                  className="app-callout flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatCustomerName(job.customer)} -{" "}
                      {job.property.address}
                    </p>
                    <p className="text-xs text-slate-500">
                      {job.scheduledDate.toLocaleTimeString()} -{" "}
                      {getJobStatusLabel(job.status, t)}
                    </p>
                  </div>
                  <span
                    className="app-chip px-3 py-1 text-xs"
                    data-tone={
                      job.type === "ON_DEMAND" ? "warning" : undefined
                    }
                  >
                    {job.type === "ON_DEMAND"
                      ? t("jobs.type.onDemand")
                      : t("jobs.type.routine")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">
              {t("admin.dashboard.alerts.title")}
            </h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p className="app-callout px-4 py-3" data-tone="info">
                {t("admin.dashboard.alerts.onDemandToday", {
                  count: jobsToday.filter((job) => job.type === "ON_DEMAND")
                    .length,
                })}
              </p>
              <p className="app-callout px-4 py-3" data-tone="warning">
                {t("admin.dashboard.alerts.pending", { count: pendingJobs })}
              </p>
            </div>
          </div>

          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">
              {t("admin.dashboard.recentInvoices.title")}
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              {invoices.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t("admin.dashboard.recentInvoices.empty")}
                </p>
              ) : (
                invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="app-callout flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {invoice.number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCustomerName(invoice.customer)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        ${invoice.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {invoice.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
