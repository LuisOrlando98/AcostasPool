import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { getJobStatusLabel } from "@/lib/constants";
import { getRequestLocale, getTranslations } from "@/i18n/server";

export default async function ClientPage() {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    include: {
      jobs: {
        orderBy: { scheduledDate: "desc" },
        include: { property: true, photos: true },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) {
    return (
      <AppShell
        title={t("client.home.title")}
        subtitle={t("client.home.subtitleEmpty")}
        role="CUSTOMER"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">
            {t("client.home.noProfile")}
          </p>
        </section>
      </AppShell>
    );
  }

  const upcomingJob = customer.jobs.find((job) => job.status !== "COMPLETED");
  const openInvoices = customer.invoices.filter(
    (invoice) => invoice.status !== "PAID"
  );

  return (
    <AppShell
      title={t("client.home.title")}
      subtitle={t("client.home.subtitle")}
      role="CUSTOMER"
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t("client.home.stats.nextService")}
          value={
            upcomingJob
              ? upcomingJob.scheduledDate.toLocaleDateString(locale)
              : t("client.home.stats.notScheduled")
          }
          helper={upcomingJob ? upcomingJob.property.address : ""}
          tone="info"
        />
        <StatCard
          label={t("client.home.stats.openInvoices")}
          value={`${openInvoices.length}`}
          helper={
            openInvoices.length > 0
              ? t("client.home.stats.latestInvoice", {
                  number: openInvoices[0].number,
                })
              : ""
          }
          tone="warning"
        />
        <StatCard
          label={t("client.home.stats.totalServices")}
          value={`${customer.jobs.length}`}
          helper={t("client.home.stats.history")}
          tone="success"
        />
      </section>

      <section className="app-card p-6 shadow-contrast">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {t("client.home.request.title")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("client.home.request.subtitle")}
            </p>
          </div>
          <a
            href="/client/request"
            className="app-button-primary px-4 py-2 text-sm font-semibold"
          >
            {t("client.home.request.action")}
          </a>
        </div>
      </section>

      <section className="app-card p-6 shadow-contrast">
        <h2 className="text-lg font-semibold">
          {t("client.home.recent.title")}
        </h2>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          {customer.jobs.slice(0, 3).map((job) => (
            <Link
              key={job.id}
              href={`/client/jobs/${job.id}`}
              className="ui-link-card block px-4 py-3"
            >
              <p className="text-xs text-slate-500">
                {job.scheduledDate.toLocaleDateString(locale)} ·{" "}
                {getJobStatusLabel(job.status, t)}
              </p>
              <p className="font-medium text-slate-900">
                {job.property.address}
              </p>
              <p className="text-xs text-slate-500">
                {t("client.home.recent.evidence", { count: job.photos.length })}
              </p>
            </Link>
          ))}
          {customer.jobs.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("client.home.recent.empty")}
            </p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
