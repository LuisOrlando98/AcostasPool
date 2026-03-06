import AppShell from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { resolveParams } from "@/lib/utils/params";
import { getJobStatusLabel } from "@/lib/constants";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import ClientJobEvidenceGallery from "@/components/client/ClientJobEvidenceGallery";
import { formatInBusinessTimeZone } from "@/lib/timezone";

export default async function ClientJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const resolvedParams = await resolveParams(params);
  const jobId = resolvedParams?.id;
  if (!jobId) {
    return (
      <AppShell
        title={t("jobs.detail.notFound")}
        subtitle={t("jobs.detail.invalidId")}
        role="CUSTOMER"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">
            {t("jobs.detail.notFoundMessage")}
          </p>
        </section>
      </AppShell>
    );
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, customer: { userId: session.sub } },
    include: {
      property: true,
      photos: {
        where: { visibleToCustomer: true },
        orderBy: { takenAt: "desc" },
      },
      serviceTier: true,
    },
  });

  if (!job) {
    return (
      <AppShell
        title={t("jobs.detail.notFound")}
        subtitle={t("jobs.detail.subtitle")}
        role="CUSTOMER"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">
            {t("jobs.detail.noAccess")}
          </p>
        </section>
      </AppShell>
    );
  }

  const serviceTypeLabelMap: Record<string, string> = {
    WEEKLY_CLEANING: t("jobs.service.weeklyCleaning"),
    FILTER_CHECK: t("jobs.service.filterCheck"),
    CHEM_BALANCE: t("jobs.service.chemBalance"),
    EQUIPMENT_CHECK: t("jobs.service.equipmentCheck"),
  };
  const serviceTypeLabel = serviceTypeLabelMap[job.serviceType] ?? job.serviceType;
  const completedOrScheduledAt = job.completedAt ?? job.scheduledDate;

  return (
    <AppShell
      title={t("jobs.detail.title")}
      subtitle={`${job.property.address}`}
      role="CUSTOMER"
    >
      <section className="app-card p-5 shadow-contrast">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {t("jobs.detail.serviceTitle")}
            </h2>
            <p className="text-sm text-slate-500">
              {formatInBusinessTimeZone(job.scheduledDate, locale, {
                dateStyle: "short",
                timeStyle: "short",
              })}{" "}
              -{" "}
              {getJobStatusLabel(job.status, t)}
            </p>
            {job.serviceTier?.name ? (
              <p className="mt-1 text-xs text-slate-500">
                {t("jobs.detail.fields.serviceTier")}: {job.serviceTier.name}
              </p>
            ) : null}
          </div>
          <span className="app-chip px-3 py-1 text-xs text-slate-500">
            {job.type === "ON_DEMAND"
              ? t("jobs.type.onDemand")
              : t("jobs.type.routine")}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t("client.home.recent.columns.date")}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatInBusinessTimeZone(completedOrScheduledAt, locale, {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t("client.home.recent.columns.property")}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{job.property.address}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t("jobs.detail.fields.serviceType")}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{serviceTypeLabel}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t("jobs.detail.fields.evidence")}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {t("jobs.detail.evidenceCount", { count: job.photos.length })}
            </p>
          </article>
        </div>

        {job.customerNotes ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t("jobs.detail.fields.customerNotes")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{job.customerNotes}</p>
          </div>
        ) : null}

        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t("jobs.detail.evidenceTitle")}
          </h3>
          {job.photos.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("jobs.detail.noEvidence")}
            </p>
          ) : (
            <ClientJobEvidenceGallery
              photos={job.photos.map((photo) => ({
                id: photo.id,
                url: photo.url,
                takenAt: photo.takenAt.toISOString(),
              }))}
              locale={locale}
              evidenceAlt={t("jobs.detail.evidenceAlt")}
              viewLabel={t("common.actions.view")}
              closeLabel={t("common.actions.close")}
            />
          )}
        </div>
      </section>
    </AppShell>
  );
}
