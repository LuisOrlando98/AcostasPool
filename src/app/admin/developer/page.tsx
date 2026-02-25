import AppShell from "@/components/layout/AppShell";
import { requireDeveloper } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export default async function DeveloperPage() {
  await requireDeveloper();

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
      title="Developer Console"
      subtitle="Acceso exclusivo a pruebas, auditoria y diagnosticos."
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Audit logs
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {auditTotal}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {latestAudit
              ? `Ultimo: ${latestAudit.action} (${latestAudit.createdAt.toLocaleString()})`
              : "Sin actividad registrada."}
          </p>
        </article>
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Notificaciones fallidas
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {failedNotifications}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Alertas con estado FAILED.
          </p>
        </article>
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Jobs activos
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {pendingJobs}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            PENDING / ON_THE_WAY / IN_PROGRESS.
          </p>
        </article>
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Usuario developer
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-900">
            luiso.rodriguezcabrera@gmail.com
          </p>
          <p className="mt-1 text-xs text-slate-500">Acceso restringido.</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <a
          href="/admin/developer/tests"
          className="app-card p-6 shadow-contrast transition hover:-translate-y-0.5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Pruebas
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Suite de diagnosticos
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Validaciones operativas para revisar salud y consistencia.
          </p>
        </a>
        <a
          href="/admin/developer/audit-log"
          className="app-card p-6 shadow-contrast transition hover:-translate-y-0.5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Seguridad
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Audit log
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Trazabilidad completa de acciones criticas.
          </p>
        </a>
        <a
          href="/api/health/db"
          target="_blank"
          rel="noreferrer"
          className="app-card p-6 shadow-contrast transition hover:-translate-y-0.5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Infraestructura
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            DB health endpoint
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Solo developer: estado de conectividad de base de datos.
          </p>
        </a>
      </section>
    </AppShell>
  );
}
