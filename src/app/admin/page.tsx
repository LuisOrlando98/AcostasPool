import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import AdminDashboardClient from "@/components/dashboard/AdminDashboardClient";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getTranslations } from "@/i18n/server";

export default async function AdminPage() {
  const session = await requireRole("ADMIN");
  const t = await getTranslations();

  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const [
    jobsToday,
    pendingJobs,
    completedJobs,
    completedWithEvidence,
    invoices,
    customers,
  ] =
    await Promise.all([
      prisma.job.findMany({
        where: { scheduledDate: { gte: startOfDay, lte: endOfDay } },
        orderBy: { scheduledDate: "asc" },
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
      prisma.job.count({
        where: {
          scheduledDate: { gte: startOfDay, lte: endOfDay },
          status: "COMPLETED",
          photos: { some: {} },
        },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
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

  const onDemandJobs = jobsToday.filter((job) => job.type === "ON_DEMAND").length;
  const serializedJobs = jobsToday.map((job) => ({
    id: job.id,
    scheduledDateIso: job.scheduledDate.toISOString(),
    status: job.status,
    type: job.type,
    customerName: formatCustomerName(job.customer),
    customerEmail: job.customer.email ?? null,
    address: job.property.address,
  }));
  const serializedInvoices = invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    total: Number(invoice.total),
    status: invoice.status,
    customerName: formatCustomerName(invoice.customer),
  }));

  return (
    <AppShell
      title={t("admin.dashboard.title")}
      subtitle={t("admin.dashboard.subtitle")}
      role="ADMIN"
    >
      {session.isDeveloper ? (
        <section className="app-card p-4 shadow-contrast sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Developer Access
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Consola de pruebas y auditoria
              </h2>
            </div>
            <Link
              href="/admin/developer"
              className="app-button-secondary px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              Abrir developer console
            </Link>
          </div>
        </section>
      ) : null}

      <AdminDashboardClient
        jobs={serializedJobs}
        invoices={serializedInvoices}
        stats={{
          jobsToday: jobsToday.length,
          pendingJobs,
          completedJobs,
          customers,
          onDemandJobs,
          completedWithEvidence,
        }}
      />
    </AppShell>
  );
}
