import AppShell from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { resolveParams } from "@/lib/utils/params";
import { getJobStatusLabel } from "@/lib/constants";
import { getAssetUrl } from "@/lib/assets";
import { getRequestLocale, getTranslations } from "@/i18n/server";

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
    include: { property: true, photos: true, serviceTier: true },
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

  return (
    <AppShell
      title={t("jobs.detail.title")}
      subtitle={`${job.property.address}`}
      role="CUSTOMER"
    >
      <section className="app-card p-5 shadow-contrast">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {t("jobs.detail.serviceTitle")}
            </h2>
            <p className="text-sm text-slate-500">
              {job.scheduledDate.toLocaleString(locale)} -{" "}
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

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {job.photos.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("jobs.detail.noEvidence")}
            </p>
          ) : (
            job.photos.map((photo) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
              >
                <img
                  src={getAssetUrl(photo.url)}
                  alt={t("jobs.detail.evidenceAlt")}
                  className="h-32 w-full object-cover"
                />
                <div className="px-3 py-2 text-xs text-slate-500">
                  {new Date(photo.takenAt).toLocaleString(locale)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
