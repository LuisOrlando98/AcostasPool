import Link from "next/link";
import { JobStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import { prisma } from "@/lib/db";
import { getJobStatusLabel } from "@/lib/constants";
import { requireRole } from "@/lib/auth/guards";
import { resolveParams } from "@/lib/utils/params";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import { formatCustomerName } from "@/lib/customers/format";
import { getAssetUrl } from "@/lib/assets";
import { getRequestLocale, getTranslations } from "@/i18n/server";

async function updateJobStatus(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const jobId = String(formData.get("jobId"));
  const status = String(formData.get("status"));

  if (!jobId || !status) {
    return;
  }

  const normalizedStatus = Object.values(JobStatus).includes(
    status as JobStatus
  )
    ? (status as JobStatus)
    : null;

  if (!normalizedStatus) {
    return;
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: normalizedStatus },
  });

  revalidatePath(`/admin/routes/${jobId}`);
}

async function updateJobTechnician(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const jobId = String(formData.get("jobId"));
  const technicianId = String(formData.get("technicianId") ?? "");

  if (!jobId) {
    return;
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { technicianId: technicianId || null },
  });

  revalidatePath(`/admin/routes/${jobId}`);
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const resolvedParams = await resolveParams(params);
  const jobId = resolvedParams?.id;
  if (!jobId) {
    return (
      <AppShell
        title={t("jobs.detail.notFound")}
        subtitle={t("jobs.detail.invalidId")}
        role="ADMIN"
      >
        <Link href="/admin/routes" className="text-sm text-slate-600">
          {t("jobs.detail.backToRoutes")}
        </Link>
      </AppShell>
    );
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      property: true,
      technician: { include: { user: true } },
      plan: true,
      serviceTier: true,
      photos: true,
    },
  });

  if (!job) {
    return (
      <AppShell
        title={t("jobs.detail.notFound")}
        subtitle={t("jobs.detail.subtitle")}
        role="ADMIN"
      >
        <Link href="/admin/routes" className="text-sm text-slate-600">
          {t("jobs.detail.backToRoutes")}
        </Link>
      </AppShell>
    );
  }

  const technicians = await prisma.technician.findMany({
    include: { user: true },
    orderBy: { user: { fullName: "asc" } },
  });

  const serviceOption = serviceTypeOptions.find(
    (option) => option.value === job.serviceType
  );
  const serviceLabel =
    serviceOption?.labelKey
      ? t(serviceOption.labelKey)
    : serviceOption?.label ?? job.serviceType;
  const serviceTierLabel =
    job.serviceTier?.name ?? t("jobs.detail.serviceTierFallback");
  const checklistItems = Array.isArray(job.checklist)
    ? (job.checklist as Array<{ label?: string; completed?: boolean }>)
    : [];
  const customerName = formatCustomerName(job.customer);

  return (
    <AppShell
      title={t("jobs.detail.title")}
      subtitle={`${customerName} - ${job.property.address}`}
      role="ADMIN"
    >
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="app-card p-6 shadow-contrast">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {t("jobs.detail.infoTitle")}
              </h2>
              <p className="text-sm text-slate-500">
                {job.scheduledDate.toLocaleString(locale)}
              </p>
            </div>
            <span className="app-chip px-3 py-1 text-xs text-slate-500">
              {getJobStatusLabel(job.status, t)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("jobs.detail.fields.tech")}
              </p>
              <p>{job.technician?.user.fullName ?? t("jobs.detail.noTech")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("jobs.detail.fields.jobType")}
              </p>
              <p>
                {job.type === "ON_DEMAND"
                  ? t("jobs.type.onDemand")
                  : t("jobs.type.routine")}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("jobs.detail.fields.serviceType")}
              </p>
              <p>{serviceLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("jobs.detail.fields.serviceTier")}
              </p>
              <p>{serviceTierLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("jobs.detail.fields.priority")}
              </p>
              <p>
                {job.priority === "URGENT"
                  ? t("jobs.priority.urgent")
                  : t("jobs.priority.normal")}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("jobs.detail.fields.duration")}
              </p>
              <p>
                {job.estimatedDurationMinutes
                  ? t("jobs.detail.durationValue", {
                      minutes: job.estimatedDurationMinutes,
                    })
                  : t("jobs.detail.durationEmpty")}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("jobs.detail.fields.plan")}
              </p>
              <p>{job.plan?.name ?? t("jobs.detail.planManual")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("jobs.detail.fields.evidence")}
              </p>
              <p>{t("jobs.detail.evidenceCount", { count: job.photos.length })}</p>
            </div>
          </div>

          {job.notes || job.customerNotes ? (
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              {job.notes ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {t("jobs.detail.fields.internalNotes")}
                  </p>
                  <p className="mt-1">{job.notes}</p>
                </div>
              ) : null}
              {job.customerNotes ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {t("jobs.detail.fields.customerNotes")}
                  </p>
                  <p className="mt-1">{job.customerNotes}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="app-card p-6 shadow-contrast">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h2 className="text-lg font-semibold">
                  {t("jobs.detail.assignTech")}
                </h2>
                <form action={updateJobTechnician} className="mt-4 space-y-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <select
                    name="technicianId"
                    className="app-input w-full bg-white px-4 py-3 text-sm"
                    defaultValue={job.technician?.id ?? ""}
                  >
                    <option value="">{t("jobs.detail.noTech")}</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.user.fullName}
                      </option>
                    ))}
                  </select>
                  <button className="app-button-primary w-full px-4 py-3 text-sm font-semibold">
                    {t("jobs.detail.actions.saveAssignment")}
                  </button>
                </form>
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {t("jobs.detail.statusTitle")}
                </h2>
                <form action={updateJobStatus} className="mt-4 space-y-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <select
                    name="status"
                    className="app-input w-full bg-white px-4 py-3 text-sm"
                    defaultValue={job.status}
                  >
                    <option value="SCHEDULED">{t("jobs.status.scheduled")}</option>
                    <option value="PENDING">{t("jobs.status.pending")}</option>
                    <option value="ON_THE_WAY">{t("jobs.status.onTheWay")}</option>
                    <option value="IN_PROGRESS">{t("jobs.status.inProgress")}</option>
                    <option value="COMPLETED">{t("jobs.status.completed")}</option>
                  </select>
                  <button className="app-button-primary w-full px-4 py-3 text-sm font-semibold">
                    {t("jobs.detail.actions.updateStatus")}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="app-card p-6 shadow-contrast">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("jobs.detail.checklist")}
              </h2>
              <Badge label={serviceLabel} tone="info" />
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {checklistItems.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t("jobs.detail.noChecklist")}
                </p>
              ) : (
                checklistItems.map((item, index) => (
                  <label
                    key={`${item.label ?? "item"}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(item.completed)}
                      readOnly
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span
                      className={
                        item.completed ? "line-through text-slate-400" : ""
                      }
                    >
                      {item.label ?? t("jobs.detail.checklistItem")}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">
              {t("jobs.detail.evidenceTitle")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          </div>
        </div>
      </section>
    </AppShell>
  );
}
