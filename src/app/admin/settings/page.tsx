import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import ServiceTiersManager from "@/components/settings/ServiceTiersManager";
import { requireRole } from "@/lib/auth/guards";
import { getSiteSocialLinks, saveSiteSocialLinks } from "@/lib/site-settings";
import { getTranslations } from "@/i18n/server";

async function saveSocialLinks(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  await saveSiteSocialLinks({
    instagramUrl: String(formData.get("instagramUrl") ?? "").trim() || null,
    facebookUrl: String(formData.get("facebookUrl") ?? "").trim() || null,
    whatsappUrl: String(formData.get("whatsappUrl") ?? "").trim() || null,
    xUrl: String(formData.get("xUrl") ?? "").trim() || null,
    youtubeUrl: String(formData.get("youtubeUrl") ?? "").trim() || null,
    tiktokUrl: String(formData.get("tiktokUrl") ?? "").trim() || null,
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
}

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const socialLinks = await getSiteSocialLinks();

  return (
    <AppShell
      title={t("admin.settings.title")}
      subtitle={t("admin.settings.subtitle")}
      role="ADMIN"
    >
      <section className="space-y-6">
        <div className="app-card p-6 shadow-contrast">
          <h2 className="text-lg font-semibold">
            {t("admin.settings.social.title")}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("admin.settings.social.subtitle")}
          </p>
          <form action={saveSocialLinks} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.settings.social.fields.instagram")}
              </label>
              <input
                name="instagramUrl"
                defaultValue={socialLinks.instagramUrl ?? ""}
                className="app-input mt-2 px-4 py-3 text-sm"
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.settings.social.fields.facebook")}
              </label>
              <input
                name="facebookUrl"
                defaultValue={socialLinks.facebookUrl ?? ""}
                className="app-input mt-2 px-4 py-3 text-sm"
                placeholder="https://facebook.com/..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.settings.social.fields.whatsapp")}
              </label>
              <input
                name="whatsappUrl"
                defaultValue={socialLinks.whatsappUrl ?? ""}
                className="app-input mt-2 px-4 py-3 text-sm"
                placeholder="+13055550199 / https://wa.me/13055550199"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.settings.social.fields.x")}
              </label>
              <input
                name="xUrl"
                defaultValue={socialLinks.xUrl ?? ""}
                className="app-input mt-2 px-4 py-3 text-sm"
                placeholder="https://x.com/..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.settings.social.fields.youtube")}
              </label>
              <input
                name="youtubeUrl"
                defaultValue={socialLinks.youtubeUrl ?? ""}
                className="app-input mt-2 px-4 py-3 text-sm"
                placeholder="https://youtube.com/@..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.settings.social.fields.tiktok")}
              </label>
              <input
                name="tiktokUrl"
                defaultValue={socialLinks.tiktokUrl ?? ""}
                className="app-input mt-2 px-4 py-3 text-sm"
                placeholder="https://tiktok.com/@..."
              />
            </div>
            <div className="sm:col-span-2">
              <button className="app-button-primary px-4 py-3 text-sm font-semibold">
                {t("admin.settings.social.actions.save")}
              </button>
            </div>
          </form>
        </div>

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

        <div className="grid gap-6 lg:grid-cols-2">
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
