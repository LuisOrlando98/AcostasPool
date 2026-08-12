import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import RequestsTable from "@/components/requests/RequestsTable";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getTranslations } from "@/i18n/server";

async function assignTechnicianAction(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  "use server";
  await requireRole("ADMIN");
  const t = await getTranslations();

  const jobId = String(formData.get("jobId") ?? "");
  const technicianId = String(formData.get("technicianId") ?? "");
  if (!jobId || !technicianId) {
    return { error: t("admin.requests.errors.generic") };
  }

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) {
    return { error: t("admin.requests.errors.generic") };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      technicianId,
      status: job.status === "PENDING" ? "SCHEDULED" : job.status,
    },
  });

  revalidatePath("/admin/requests");
  revalidatePath("/admin/routes");
}

export default async function AdminRequestsPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  const [jobs, technicians] = await Promise.all([
    prisma.job.findMany({
      where: { type: "ON_DEMAND" },
      orderBy: { requestedAt: "desc" },
      select: {
        id: true,
        status: true,
        priority: true,
        requestCategory: true,
        requestIssue: true,
        customerNotes: true,
        requestedAt: true,
        createdAt: true,
        customerId: true,
        customer: { select: { nombre: true, apellidos: true } },
        property: { select: { name: true, address: true } },
        technician: { select: { id: true, user: { select: { fullName: true } } } },
      },
    }),
    prisma.technician.findMany({
      include: { user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
  ]);

  const rows = jobs.map((job) => ({
    id: job.id,
    customerId: job.customerId,
    customerName: formatCustomerName(job.customer),
    propertyLabel: job.property.name?.trim() || job.property.address,
    status: job.status,
    priority: job.priority,
    requestCategory: job.requestCategory,
    requestIssue: job.requestIssue,
    notes: job.customerNotes,
    requestedAt: (job.requestedAt ?? job.createdAt).toISOString(),
    technicianId: job.technician?.id ?? null,
    technicianName: job.technician?.user.fullName ?? null,
  }));

  const unassignedCount = rows.filter(
    (row) => !row.technicianId && row.status !== "COMPLETED"
  ).length;
  const assignedCount = rows.filter(
    (row) => Boolean(row.technicianId) && row.status !== "COMPLETED"
  ).length;
  const resolvedCount = rows.filter((row) => row.status === "COMPLETED").length;
  const urgentCount = rows.filter(
    (row) => row.priority === "URGENT" && row.status !== "COMPLETED"
  ).length;

  return (
    <AppShell
      title={t("admin.requests.title")}
      subtitle={t("admin.requests.subtitle")}
      role="ADMIN"
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("admin.requests.stats.unassigned")}
          value={String(unassignedCount)}
          helper={t("admin.requests.stats.unassignedHelper")}
          tone={unassignedCount > 0 ? "warning" : "success"}
        />
        <StatCard
          label={t("admin.requests.stats.assigned")}
          value={String(assignedCount)}
          helper={t("admin.requests.stats.assignedHelper")}
          tone="info"
        />
        <StatCard
          label={t("admin.requests.stats.resolved")}
          value={String(resolvedCount)}
          helper={t("admin.requests.stats.resolvedHelper")}
          tone="success"
        />
        <StatCard
          label={t("admin.requests.stats.urgent")}
          value={String(urgentCount)}
          helper={t("admin.requests.stats.urgentHelper")}
          tone={urgentCount > 0 ? "danger" : "success"}
        />
      </section>

      <div className="mt-6">
        <RequestsTable
          rows={rows}
          technicians={technicians.map((tech) => ({ id: tech.id, name: tech.user.fullName }))}
          assignAction={assignTechnicianAction}
        />
      </div>
    </AppShell>
  );
}
