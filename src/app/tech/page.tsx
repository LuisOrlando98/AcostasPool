import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getRequestLocale, getTranslations } from "@/i18n/server";

export default async function TechPage() {
  await requireRole("TECH");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const technician = await prisma.technician.findUnique({
    where: { userId: session.sub },
  });

  if (!technician) {
    return (
      <AppShell
        title={t("tech.home.title")}
        subtitle={t("tech.home.subtitleEmpty")}
        role="TECH"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">{t("tech.home.noProfile")}</p>
        </section>
      </AppShell>
    );
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const todaysJobs = await prisma.job.findMany({
    where: {
      technicianId: technician.id,
      scheduledDate: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { scheduledDate: "asc" },
    select: {
      id: true,
      scheduledDate: true,
      status: true,
      type: true,
      priority: true,
      serviceType: true,
      customer: { select: { nombre: true, apellidos: true } },
      property: { select: { address: true } },
      photos: { select: { id: true } },
    },
  });

  const remainingJobs = todaysJobs.filter((job) => job.status !== "COMPLETED");
  const pendingCount = remainingJobs.length;
  const completedCount = todaysJobs.filter(
    (job) => job.status === "COMPLETED"
  ).length;
  const completedWithPhotos = todaysJobs.filter(
    (job) => job.status === "COMPLETED" && job.photos.length > 0
  ).length;
  const onDemandCount = todaysJobs.filter(
    (job) => job.type === "ON_DEMAND"
  ).length;
  const nextJob = remainingJobs[0] ?? null;
  const allDone = todaysJobs.length > 0 && remainingJobs.length === 0;
  const serviceLabelMap: Record<string, string> = {
    WEEKLY_CLEANING: t("jobs.service.weeklyCleaning"),
    FILTER_CHECK: t("jobs.service.filterCheck"),
    CHEM_BALANCE: t("jobs.service.chemBalance"),
    EQUIPMENT_CHECK: t("jobs.service.equipmentCheck"),
  };

  return (
    <AppShell
      title={t("tech.home.title")}
      subtitle={t("tech.home.subtitle")}
      role="TECH"
    >
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="app-card p-6 shadow-contrast">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                {t("tech.home.next.kicker")}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                {t("tech.home.next.title")}
              </h2>
            </div>
            <span className="app-chip px-3 py-1 text-xs" data-tone="info">
              {t("tech.home.next.today")}
            </span>
          </div>

          {nextJob ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {formatCustomerName(nextJob.customer)}
                </p>
                <p className="text-sm text-slate-500">
                  {nextJob.property.address}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="app-chip px-2 py-1 text-xs" data-tone="info">
                  {serviceLabelMap[nextJob.serviceType] ?? nextJob.serviceType}
                </span>
                <span
                  className="app-chip px-2 py-1 text-xs"
                  data-tone={nextJob.priority === "URGENT" ? "danger" : "warning"}
                >
                  {nextJob.priority === "URGENT"
                    ? t("jobs.priority.urgent")
                    : t("jobs.priority.normal")}
                </span>
                <span className="app-chip px-2 py-1 text-xs" data-tone="success">
                  {nextJob.scheduledDate.toLocaleTimeString(locale)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/tech/jobs/${nextJob.id}`}
                  className="app-button-primary w-full px-4 py-3 text-sm font-semibold sm:w-auto"
                >
                  {t("tech.home.next.complete")}
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              {allDone ? t("tech.home.next.done") : t("tech.home.list.empty")}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label={t("tech.home.stats.stops")}
            value={`${todaysJobs.length}`}
            helper={t("tech.home.stats.scheduled")}
            tone="info"
          />
          <StatCard
            label={t("tech.home.stats.pending")}
            value={`${pendingCount}`}
            helper={t("tech.home.stats.remaining")}
            tone="warning"
          />
          <StatCard
            label={t("tech.home.stats.completed")}
            value={`${completedCount}`}
            helper={`${completedWithPhotos} ${t("tech.home.stats.withPhotos")}`}
            tone="success"
          />
          <StatCard
            label={t("tech.home.stats.onDemand")}
            value={`${onDemandCount}`}
            helper={t("tech.home.stats.quickRequests")}
            tone="info"
          />
        </div>
      </section>

      <section className="app-card p-6 shadow-contrast">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("tech.home.list.title")}</h2>
        </div>
        <div className="mt-4 space-y-3">
          {todaysJobs.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("tech.home.list.empty")}
            </p>
          ) : (
            todaysJobs.map((job) => (
              <div
                key={job.id}
                className="app-callout flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCustomerName(job.customer)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {job.property.address}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="app-chip px-2 py-1 text-xs" data-tone="info">
                      {serviceLabelMap[job.serviceType] ?? job.serviceType}
                    </span>
                    <span
                      className="app-chip px-2 py-1 text-xs"
                      data-tone={job.priority === "URGENT" ? "danger" : "warning"}
                    >
                      {job.priority === "URGENT"
                        ? t("jobs.priority.urgent")
                        : t("jobs.priority.normal")}
                    </span>
                    <span
                      className="app-chip px-2 py-1 text-xs"
                      data-tone={job.type === "ON_DEMAND" ? "warning" : "info"}
                    >
                      {job.type === "ON_DEMAND"
                        ? t("jobs.type.onDemand")
                        : t("jobs.type.routine")}
                    </span>
                    <span className="app-chip px-2 py-1 text-xs" data-tone="success">
                      {job.scheduledDate.toLocaleTimeString(locale)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Link
                    href={`/tech/jobs/${job.id}`}
                    className="app-button-primary w-full px-4 py-3 text-xs font-semibold sm:w-auto"
                  >
                    {t("tech.home.list.upload")}
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
