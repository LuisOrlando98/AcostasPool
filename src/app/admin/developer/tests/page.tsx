import AppShell from "@/components/layout/AppShell";
import { requireDeveloper } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getTranslations } from "@/i18n/server";

export default async function DeveloperTestsPage() {
  const t = await getTranslations();
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
      title={t("admin.developer.tests.title")}
      subtitle={t("admin.developer.tests.subtitle")}
    >
      <section className="space-y-4">
        <article className="app-card p-6 shadow-contrast">
          <h2 className="text-lg font-semibold text-slate-900">
            {t("admin.developer.tests.platform")}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {t("admin.developer.tests.metrics.db")}
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {dbReachable
                  ? t("admin.developer.tests.metrics.dbReachable")
                  : t("admin.developer.tests.metrics.dbUnreachable")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {t("admin.developer.tests.metrics.jobsWithoutTech")}
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {jobsWithoutTech}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {t("admin.developer.tests.metrics.overdueInvoices")}
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {overdueInvoices}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {t("admin.developer.tests.metrics.unreadAdmin")}
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
