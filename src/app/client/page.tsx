import AppShell from "@/components/layout/AppShell";
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
          <p className="text-sm text-slate-500">{t("client.home.noProfile")}</p>
        </section>
      </AppShell>
    );
  }

  const now = new Date();
  const upcomingJob =
    customer.jobs
      .filter((job) => job.status !== "COMPLETED" && job.scheduledDate >= now)
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())[0] ??
    customer.jobs.find((job) => job.status !== "COMPLETED");

  const openInvoices = customer.invoices.filter(
    (invoice) => invoice.status !== "PAID"
  );

  const completedJobs = customer.jobs
    .filter((job) => job.status === "COMPLETED")
    .sort(
      (a, b) =>
        (b.completedAt ?? b.scheduledDate).getTime() -
        (a.completedAt ?? a.scheduledDate).getTime()
    );

  const recentCompletedJobs = completedJobs.slice(0, 8);

  return (
    <AppShell
      title={t("client.home.title")}
      subtitle={t("client.home.subtitle")}
      role="CUSTOMER"
    >
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <article className="relative overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50 via-cyan-50 to-white p-4 shadow-[0_10px_24px_rgba(14,165,233,0.12)] sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t("client.home.stats.nextService")}
          </p>
          <p className="mt-2 break-words text-2xl font-semibold leading-tight text-slate-900 sm:text-[1.8rem]">
            {upcomingJob
              ? upcomingJob.scheduledDate.toLocaleDateString(locale)
              : t("client.home.stats.notScheduled")}
          </p>
          <p className="mt-2 break-words text-xs text-slate-600">
            {upcomingJob?.property.address ?? t("client.home.stats.notScheduledHelper")}
          </p>
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50 to-white p-4 shadow-[0_10px_24px_rgba(249,115,22,0.12)] sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t("client.home.stats.openInvoices")}
          </p>
          <p className="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-[1.8rem]">
            {openInvoices.length}
          </p>
          <p className="mt-2 break-words text-xs text-slate-600">
            {openInvoices.length > 0
              ? t("client.home.stats.latestInvoice", {
                  number: openInvoices[0].number,
                })
              : t("client.home.stats.noneOpenInvoices")}
          </p>
        </article>

        <article className="relative col-span-2 overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-4 shadow-[0_10px_24px_rgba(16,185,129,0.12)] sm:p-5 lg:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t("client.home.stats.totalServices")}
          </p>
          <p className="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-[1.8rem]">
            {customer.jobs.length}
          </p>
          <p className="mt-2 text-xs text-slate-600">{t("client.home.stats.history")}</p>
        </article>
      </section>

      <section className="app-card p-4 shadow-contrast sm:p-5">
        <div className="rounded-2xl border border-sky-100 bg-[linear-gradient(120deg,rgba(14,165,233,0.08),rgba(34,197,94,0.04),rgba(255,255,255,0.9))] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">
                {t("client.home.request.title")}
              </h2>
              <p className="text-sm text-slate-600">
                {t("client.home.request.subtitle")}
              </p>
            </div>
            <a
              href="/client/request"
              className="app-button-primary inline-flex w-full items-center justify-center px-4 py-2.5 text-sm font-semibold sm:w-auto"
            >
              {t("client.home.request.action")}
            </a>
          </div>
        </div>
      </section>

      <section className="app-card p-4 shadow-contrast sm:p-5">
        <div>
          <h2 className="text-lg font-semibold">{t("client.home.recent.title")}</h2>
          <p className="text-sm text-slate-500">{t("client.home.recent.subtitle")}</p>
        </div>

        {recentCompletedJobs.length > 0 ? (
          <div className="mt-4">
            <div className="space-y-2 sm:hidden">
              {recentCompletedJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/client/jobs/${job.id}`}
                  className="block rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-sky-300 hover:bg-sky-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {(job.completedAt ?? job.scheduledDate).toLocaleDateString(locale)}
                    </p>
                    <span
                      className="app-chip inline-flex items-center px-2 py-1 text-[11px]"
                      data-tone="success"
                    >
                      {getJobStatusLabel(job.status, t)}
                    </span>
                  </div>
                  <p
                    className="mt-2 overflow-hidden text-sm leading-5 text-slate-700"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                    title={job.property.address}
                  >
                    {job.property.address}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {job.type === "ON_DEMAND"
                        ? t("jobs.type.onDemand")
                        : t("jobs.type.routine")}
                    </span>
                    <span className="font-semibold text-sky-700">{t("common.actions.view")}</span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 sm:block">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t("client.home.recent.columns.date")}</th>
                    <th className="px-3 py-2 font-semibold">{t("client.home.recent.columns.property")}</th>
                    <th className="px-3 py-2 font-semibold">{t("client.home.recent.columns.type")}</th>
                    <th className="px-3 py-2 font-semibold">{t("client.home.recent.columns.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {recentCompletedJobs.map((job) => (
                    <tr key={job.id} className="transition hover:bg-sky-50/40">
                      <td className="p-0">
                        <Link
                          href={`/client/jobs/${job.id}`}
                          className="block whitespace-nowrap px-3 py-3"
                        >
                          {(job.completedAt ?? job.scheduledDate).toLocaleDateString(locale)}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link
                          href={`/client/jobs/${job.id}`}
                          className="block px-3 py-3"
                          title={job.property.address}
                        >
                          <span className="block max-w-[20rem] truncate">{job.property.address}</span>
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link
                          href={`/client/jobs/${job.id}`}
                          className="block whitespace-nowrap px-3 py-3"
                        >
                          {job.type === "ON_DEMAND"
                            ? t("jobs.type.onDemand")
                            : t("jobs.type.routine")}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link
                          href={`/client/jobs/${job.id}`}
                          className="block whitespace-nowrap px-3 py-3"
                        >
                          <span
                            className="app-chip inline-flex items-center px-2 py-1 text-[11px]"
                            data-tone="success"
                          >
                            {getJobStatusLabel(job.status, t)}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            {t("client.home.recent.empty")}
          </div>
        )}

      </section>
    </AppShell>
  );
}
