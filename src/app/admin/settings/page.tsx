import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import ServiceTiersManager from "@/components/settings/ServiceTiersManager";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
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
  const socialFields = [
    {
      key: "instagramUrl",
      label: t("admin.settings.social.fields.instagram"),
      placeholder: "https://instagram.com/...",
      hint: t("admin.settings.social.hints.instagram"),
      value: socialLinks.instagramUrl ?? "",
      icon: "IG",
    },
    {
      key: "facebookUrl",
      label: t("admin.settings.social.fields.facebook"),
      placeholder: "https://facebook.com/...",
      hint: t("admin.settings.social.hints.facebook"),
      value: socialLinks.facebookUrl ?? "",
      icon: "FB",
    },
    {
      key: "whatsappUrl",
      label: t("admin.settings.social.fields.whatsapp"),
      placeholder: "+13055550199 / https://wa.me/13055550199",
      hint: t("admin.settings.social.hints.whatsapp"),
      value: socialLinks.whatsappUrl ?? "",
      icon: "WA",
    },
    {
      key: "xUrl",
      label: t("admin.settings.social.fields.x"),
      placeholder: "https://x.com/...",
      hint: t("admin.settings.social.hints.x"),
      value: socialLinks.xUrl ?? "",
      icon: "X",
    },
    {
      key: "youtubeUrl",
      label: t("admin.settings.social.fields.youtube"),
      placeholder: "https://youtube.com/@...",
      hint: t("admin.settings.social.hints.youtube"),
      value: socialLinks.youtubeUrl ?? "",
      icon: "YT",
    },
    {
      key: "tiktokUrl",
      label: t("admin.settings.social.fields.tiktok"),
      placeholder: "https://tiktok.com/@...",
      hint: t("admin.settings.social.hints.tiktok"),
      value: socialLinks.tiktokUrl ?? "",
      icon: "TT",
    },
  ] as const;

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
          <form action={saveSocialLinks} className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {socialFields.map((field) => (
                <label
                  key={field.key}
                  className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-sm transition hover:border-sky-200"
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold tracking-[0.08em] text-white">
                      {field.icon}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {field.label}
                    </span>
                  </span>
                  <input
                    name={field.key}
                    defaultValue={field.value}
                    className="app-input mt-3 w-full px-4 py-3 text-sm"
                    placeholder={field.placeholder}
                  />
                  <span className="mt-2 block text-[11px] text-slate-400">
                    {field.hint}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">
                {t("admin.settings.social.footerHint")}
              </p>
              <FormSubmitButton
                idleLabel={t("admin.settings.social.actions.save")}
                pendingLabel={t("common.feedback.saving")}
                successLabel={t("common.feedback.saved")}
                className="px-5 py-2.5"
              />
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
