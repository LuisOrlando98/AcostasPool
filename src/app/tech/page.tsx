import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { geocodeAddresses } from "@/lib/routing/geo";
import {
  getAddressPairKey,
  getTravelMetricsForPairs,
} from "@/lib/routing/travel";

export default async function TechPage() {
  const session = await requireRole("TECH");
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
      customer: { select: { nombre: true, apellidos: true, telefono: true } },
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
  const routeJobs = remainingJobs;
  const allDone = todaysJobs.length > 0 && remainingJobs.length === 0;
  const serviceLabelMap: Record<string, string> = {
    WEEKLY_CLEANING: t("jobs.service.weeklyCleaning"),
    FILTER_CHECK: t("jobs.service.filterCheck"),
    CHEM_BALANCE: t("jobs.service.chemBalance"),
    EQUIPMENT_CHECK: t("jobs.service.equipmentCheck"),
  };

  const toMinutes = (from: Date, to: Date) =>
    Math.max(1, Math.round((to.getTime() - from.getTime()) / 60000));

  const geocodedByAddress = await geocodeAddresses(
    routeJobs.map((job) => job.property.address)
  );
  const routePairMetrics = await getTravelMetricsForPairs(
    routeJobs.slice(1).map((job, index) => {
      const previous = routeJobs[index];
      return {
        fromAddress: previous.property.address,
        toAddress: job.property.address,
        fromCoordinates: geocodedByAddress.get(previous.property.address) ?? null,
        toCoordinates: geocodedByAddress.get(job.property.address) ?? null,
      };
    })
  );

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
                {nextJob.customer.telefono ? (
                  <a
                    href={`tel:${nextJob.customer.telefono.replace(/\s+/g, "")}`}
                    className="app-button-secondary w-full px-4 py-3 text-sm font-semibold sm:w-auto"
                  >
                    {t("tech.home.route.call")}
                  </a>
                ) : null}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    nextJob.property.address
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="app-button-secondary w-full px-4 py-3 text-sm font-semibold sm:w-auto"
                >
                  {t("tech.home.route.openMap")}
                </a>
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
          <h2 className="text-lg font-semibold">{t("tech.home.route.title")}</h2>
        </div>
        <div className="mt-4 space-y-3">
          {routeJobs.length === 0 ? (
            <p className="text-sm text-slate-500">
              {allDone ? t("tech.home.next.done") : t("tech.home.route.empty")}
            </p>
          ) : (
            <ol className="space-y-3">
              {routeJobs.map((job, index) => {
                const previous = routeJobs[index - 1] ?? null;
                const awayMinutes = Math.round(
                  (job.scheduledDate.getTime() - now.getTime()) / 60000
                );
                const tripMetric =
                  previous == null
                    ? null
                    : routePairMetrics.get(
                        getAddressPairKey(
                          previous.property.address,
                          job.property.address
                        )
                      ) ?? null;
                const tripMinutes = previous
                  ? tripMetric?.durationMinutes ??
                    toMinutes(previous.scheduledDate, job.scheduledDate)
                  : 1;
                const timingLabel =
                  index === 0
                    ? awayMinutes <= 1
                      ? t("tech.home.route.now")
                      : t("tech.home.route.away", { count: awayMinutes })
                    : t("tech.home.route.trip", {
                        count: tripMinutes,
                      });
                const tripSourceLabel =
                  index === 0 || !tripMetric
                    ? null
                    : tripMetric.source === "LIVE_TRAFFIC"
                      ? t("tech.home.route.liveTraffic")
                      : tripMetric.source === "SAME_ADDRESS"
                        ? t("tech.home.route.sameAddress")
                        : t("tech.home.route.estimated");

                return (
                  <li key={job.id} className="relative pl-6">
                    <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-slate-800" />
                    {index < routeJobs.length - 1 ? (
                      <span className="absolute left-[3px] top-4 h-[calc(100%+0.8rem)] border-l border-dashed border-slate-300" />
                    ) : null}

                    <p className="text-xs font-semibold text-slate-500">{timingLabel}</p>
                    {tripSourceLabel ? (
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        {tripSourceLabel}
                      </p>
                    ) : null}

                    <div className="mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <p className="text-sm font-semibold text-slate-900">
                        {t("tech.home.route.stop", { count: index + 1 })}
                      </p>
                      <p className="text-sm text-slate-700">{formatCustomerName(job.customer)}</p>
                      <p className="text-xs text-slate-500">{job.property.address}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
                        <span className="app-chip px-2 py-1 text-xs" data-tone="success">
                          {job.scheduledDate.toLocaleTimeString(locale)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            job.property.address
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="app-button-ghost inline-flex items-center justify-center px-4 py-2 text-xs font-semibold"
                        >
                          {t("tech.home.route.openMap")}
                        </a>
                        {job.customer.telefono ? (
                          <a
                            href={`tel:${job.customer.telefono.replace(/\s+/g, "")}`}
                            className="app-button-ghost inline-flex items-center justify-center px-4 py-2 text-xs font-semibold"
                          >
                            {t("tech.home.route.call")}
                          </a>
                        ) : null}
                        <Link
                          href={`/tech/jobs/${job.id}`}
                          className="app-button-primary inline-flex items-center justify-center px-4 py-2 text-xs font-semibold"
                        >
                          {t("tech.home.list.upload")}
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </AppShell>
  );
}
