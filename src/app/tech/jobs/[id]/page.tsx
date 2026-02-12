import AppShell from "@/components/layout/AppShell";
import TechJobUploadForm from "@/components/tech/TechJobUploadForm";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { resolveParams } from "@/lib/utils/params";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import { formatCustomerName } from "@/lib/customers/format";
import { getRequestLocale, getTranslations } from "@/i18n/server";

export default async function TechJobUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("TECH");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const resolvedParams = await resolveParams(params);
  const jobId = resolvedParams?.id;
  if (!jobId) {
    return (
      <AppShell
        title={t("tech.jobs.upload.title")}
        subtitle={t("jobs.detail.notFound")}
        role="TECH"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">
            {t("jobs.detail.notFoundMessage")}
          </p>
        </section>
      </AppShell>
    );
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      property: true,
      technician: { include: { user: true } },
      serviceTier: true,
    },
  });

  if (!job) {
    return (
      <AppShell
        title={t("tech.jobs.upload.title")}
        subtitle={t("jobs.detail.notFound")}
        role="TECH"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">
            {t("jobs.detail.notFoundMessage")}
          </p>
        </section>
      </AppShell>
    );
  }

  if (job.technician?.userId !== session.sub) {
    return (
      <AppShell
        title={t("tech.jobs.upload.title")}
        subtitle={t("jobs.detail.noAccess")}
        role="TECH"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">{t("jobs.detail.noAccess")}</p>
        </section>
      </AppShell>
    );
  }

  const serviceOption = serviceTypeOptions.find(
    (option) => option.value === job.serviceType
  );
  const serviceLabel =
    serviceOption?.labelKey
      ? t(serviceOption.labelKey)
      : serviceOption?.label ?? job.serviceType;
  const serviceTierLabel = job.serviceTier?.name ?? null;
  const serviceDescriptor = serviceTierLabel
    ? `${serviceTierLabel} · ${serviceLabel}`
    : serviceLabel;
  const checklistItems = Array.isArray(job.checklist)
    ? (job.checklist as Array<{ label?: string; completed?: boolean }>)
    : [];
  const accessInfo = job.property.accessInfo || job.property.locationNotes || null;

  return (
    <AppShell
      title={t("tech.jobs.upload.title")}
      subtitle={t("tech.jobs.upload.subtitle")}
      role="TECH"
    >
      <TechJobUploadForm
        job={{
          id: job.id,
          customerName: formatCustomerName(job.customer),
          propertyAddress: job.property.address,
          scheduledTime: job.scheduledDate.toLocaleTimeString(locale),
          serviceLabel: serviceDescriptor,
          priorityLabel:
            job.priority === "URGENT"
              ? t("jobs.priority.urgent")
              : t("jobs.priority.normal"),
          priorityTone: job.priority === "URGENT" ? "danger" : "warning",
          typeLabel:
            job.type === "ON_DEMAND"
              ? t("jobs.type.onDemand")
              : t("jobs.type.routine"),
          accessInfo,
          checklist: checklistItems,
          internalNotes: job.notes ?? null,
          customerNotes: job.customerNotes ?? null,
          status: job.status,
        }}
      />
    </AppShell>
  );
}
