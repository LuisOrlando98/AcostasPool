import AppShell from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { getTranslations } from "@/i18n/server";

export default async function TechProfilePage() {
  const session = await requireRole("TECH");
  const t = await getTranslations();

  const technician = await prisma.technician.findUnique({
    where: { userId: session.sub },
    include: { user: true },
  });

  return (
    <AppShell
      title={t("tech.profile.title")}
      subtitle={t("tech.profile.subtitle")}
      role="TECH"
    >
      <section className="app-card p-6 shadow-contrast">
        {technician ? (
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("tech.profile.fields.name")}
              </p>
              <p>{technician.user.fullName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("common.labels.email")}
              </p>
              <p>{technician.user.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("common.labels.phone")}
              </p>
              <p>{technician.phone || t("common.labels.notAvailable")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {t("common.labels.language")}
              </p>
              <p>
                {technician.user.locale === "EN"
                  ? t("common.language.en")
                  : t("common.language.es")}
              </p>
            </div>
            <a
              href="/account"
              className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              {t("tech.profile.manageAccount")}
            </a>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {t("tech.profile.empty")}
          </p>
        )}
      </section>
    </AppShell>
  );
}
