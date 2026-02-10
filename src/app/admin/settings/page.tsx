import AppShell from "@/components/layout/AppShell";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import ServiceTiersManager from "@/components/settings/ServiceTiersManager";
import { requireRole } from "@/lib/auth/guards";
import { getTranslations } from "@/i18n/server";

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  return (
    <AppShell
      title={t("admin.settings.title")}
      subtitle={t("admin.settings.subtitle")}
      role="ADMIN"
    >
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">
              {t("admin.settings.business.title")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                className="app-input px-4 py-3 text-sm"
                placeholder={t("admin.settings.business.placeholders.name")}
              />
              <input
                className="app-input px-4 py-3 text-sm"
                placeholder={t("admin.settings.business.placeholders.phone")}
              />
              <input
                className="app-input px-4 py-3 text-sm sm:col-span-2"
                placeholder={t("admin.settings.business.placeholders.address")}
              />
              <input
                className="app-input px-4 py-3 text-sm"
                placeholder={t("admin.settings.business.placeholders.supportEmail")}
              />
              <input
                className="app-input px-4 py-3 text-sm"
                placeholder={t("admin.settings.business.placeholders.timezone")}
              />
            </div>
          </div>

          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">
              {t("admin.settings.billing.title")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                className="app-input px-4 py-3 text-sm"
                placeholder={t("admin.settings.billing.placeholders.prefix")}
              />
              <input
                className="app-input px-4 py-3 text-sm"
                placeholder={t("admin.settings.billing.placeholders.tax")}
              />
              <input
                className="app-input px-4 py-3 text-sm sm:col-span-2"
                placeholder={t("admin.settings.billing.placeholders.notes")}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">
              {t("admin.settings.tiers.title")}
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              {t("admin.settings.tiers.subtitle")}
            </p>
            <div className="mt-4">
              <ServiceTiersManager />
            </div>
          </div>

          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">
              {t("admin.settings.smtp.title")}
            </h2>
            <div className="mt-4 grid gap-3">
              <input
                className="app-input px-4 py-3 text-sm"
                placeholder="smtp.office365.com"
              />
              <input
                className="app-input px-4 py-3 text-sm"
                placeholder={t("admin.settings.smtp.placeholders.user")}
              />
              <input
                type="password"
                className="app-input px-4 py-3 text-sm"
                placeholder={t("admin.settings.smtp.placeholders.password")}
              />
              <button className="app-button-primary px-4 py-3 text-sm font-semibold">
                {t("admin.settings.smtp.actions.save")}
              </button>
            </div>
          </div>

          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">
              {t("admin.settings.notifications.title")}
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              {t("admin.settings.notifications.subtitle")}
            </p>
            <NotificationPreferences />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
