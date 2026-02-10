import AppShell from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getRequestLocale, getTranslations } from "@/i18n/server";

export default async function TechHistoryPage() {
  const session = await requireRole("TECH");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const technician = await prisma.technician.findUnique({
    where: { userId: session.sub },
  });

  const jobs = technician
    ? await prisma.job.findMany({
        where: { technicianId: technician.id, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        include: { customer: true, property: true, photos: true },
      })
    : [];

  return (
    <AppShell
      title={t("tech.history.title")}
      subtitle={t("tech.history.subtitle")}
      role="TECH"
    >
      <section className="app-card p-6 shadow-contrast">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("tech.history.completed")}
          </h2>
          <span className="text-xs text-slate-400">
            {t("tech.history.total", { count: jobs.length })}
          </span>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("tech.history.empty")}
            </p>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="app-callout px-4 py-3"
              >
                <p className="font-medium text-slate-900">
                  {formatCustomerName(job.customer)} · {job.property.address}
                </p>
                <p className="text-xs text-slate-500">
                  {job.completedAt
                    ? job.completedAt.toLocaleDateString(locale)
                    : t("tech.history.noDate")}{" "}
                  · {t("tech.history.photos", { count: job.photos.length })}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
