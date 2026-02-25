import AppShell from "@/components/layout/AppShell";
import { requireDeveloper } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export default async function DeveloperTestsPage() {
  await requireDeveloper();

  let dbReachable = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReachable = true;
  } catch {
    dbReachable = false;
  }

  const [jobsWithoutTech, overdueInvoices, unreadAdminNotifications] =
    await Promise.all([
      prisma.job.count({
        where: {
          status: { in: ["SCHEDULED", "PENDING"] },
          technicianId: null,
        },
      }),
      prisma.invoice.count({ where: { status: "OVERDUE" } }),
      prisma.notification.count({
        where: { recipientRole: "ADMIN", readAt: null },
      }),
    ]);

  return (
    <AppShell
      role="ADMIN"
      title="Developer Tests"
      subtitle="Checks rapidos para validar estado operativo."
    >
      <section className="space-y-4">
        <article className="app-card p-6 shadow-contrast">
          <h2 className="text-lg font-semibold text-slate-900">
            Diagnostico de plataforma
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                DB
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {dbReachable ? "Reachable" : "Unreachable"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Jobs sin tecnico
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {jobsWithoutTech}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Facturas vencidas
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {overdueInvoices}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Admin unread
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {unreadAdminNotifications}
              </p>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
