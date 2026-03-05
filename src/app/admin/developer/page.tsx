import AppShell from "@/components/layout/AppShell";
import { requireDeveloper } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getRequestLocale, getTranslations } from "@/i18n/server";

export default async function DeveloperPage() {
  await requireDeveloper();
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const [auditTotal, latestAudit, failedNotifications, pendingJobs] =
    await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, action: true },
      }),
      prisma.notification.count({ where: { status: "FAILED" } }),
      prisma.job.count({
        where: {
          status: { in: ["PENDING", "ON_THE_WAY", "IN_PROGRESS"] },
        },
      }),
    ]);

  return (
    <AppShell
      role="ADMIN"
      title={t("admin.developer.title")}
      subtitle={t("admin.developer.subtitle")}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t("admin.developer.cards.auditLogs.title")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {auditTotal}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {latestAudit
              ? t("admin.developer.cards.auditLogs.latest", {
                  action: latestAudit.action,
                  date: latestAudit.createdAt.toLocaleString(locale),
                })
              : t("admin.developer.cards.auditLogs.empty")}
          </p>
        </article>
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t("admin.developer.cards.failedNotifications.title")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {failedNotifications}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t("admin.developer.cards.failedNotifications.subtitle")}
          </p>
        </article>
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t("admin.developer.cards.activeJobs.title")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {pendingJobs}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t("admin.developer.cards.activeJobs.subtitle")}
          </p>
        </article>
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t("admin.developer.cards.developerUser.title")}
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-900">
            luiso.rodriguezcabrera@gmail.com
          </p>
          <p className="mt-1 text-xs text-slate-500">{t("admin.developer.cards.developerUser.subtitle")}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <a
          href="/admin/developer/tests"
          className="app-card p-6 shadow-contrast transition hover:-translate-y-0.5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t("admin.developer.links.tests.kicker")}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {t("admin.developer.links.tests.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("admin.developer.links.tests.subtitle")}
          </p>
        </a>
        <a
          href="/admin/developer/audit-log"
          className="app-card p-6 shadow-contrast transition hover:-translate-y-0.5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t("admin.developer.links.audit.kicker")}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {t("admin.developer.links.audit.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("admin.developer.links.audit.subtitle")}
          </p>
        </a>
        <a
          href="/api/health/db"
          target="_blank"
          rel="noreferrer"
          className="app-card p-6 shadow-contrast transition hover:-translate-y-0.5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t("admin.developer.links.infrastructure.kicker")}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {t("admin.developer.links.infrastructure.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("admin.developer.links.infrastructure.subtitle")}
          </p>
        </a>
      </section>
    </AppShell>
  );
}
