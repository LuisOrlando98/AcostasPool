import AppShell from "@/components/layout/AppShell";
import AvatarUpload from "@/components/account/AvatarUpload";
import ResetLinkButton from "@/components/account/ResetLinkButton";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";

async function updateProfile(formData: FormData) {
  "use server";
  const session = await requireAuth();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const locale = String(formData.get("locale") ?? "EN");

  if (!fullName || !email) {
    return;
  }

  await prisma.user.update({
    where: { id: session.sub },
    data: {
      fullName,
      email,
      locale: locale === "EN" ? "EN" : "ES",
    },
  });

  if (session.role === "CUSTOMER") {
    await prisma.customer.updateMany({
      where: { userId: session.sub },
      data: { idiomaPreferencia: locale === "EN" ? "EN" : "ES" },
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, normalizeLocale(locale), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export default async function AccountPage() {
  const session = await requireAuth();
  const t = await getTranslations();
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
  });

  if (!user) {
    return null;
  }

  return (
    <AppShell
      title={t("account.title")}
      subtitle={t("account.subtitle")}
      role={user.role}
    >
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t("account.profile.title")}</h2>
            <form action={updateProfile} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("account.profile.name")}
                </label>
                <input
                  name="fullName"
                  defaultValue={user.fullName}
                  className="app-input mt-2 w-full px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("common.labels.email")}
                </label>
                <input
                  name="email"
                  type="email"
                  defaultValue={user.email}
                  className="app-input mt-2 w-full px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("common.labels.language")}
                </label>
                <select
                  name="locale"
                  defaultValue={user.locale}
                  className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                >
                  <option value="EN">EN</option>
                  <option value="ES">ES</option>
                </select>
              </div>
              <button className="app-button-primary w-full px-4 py-3 text-sm font-semibold">
                {t("common.actions.save")}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t("account.photo.title")}</h2>
            <div className="mt-4">
              <AvatarUpload avatarUrl={user.avatarUrl} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t("account.credentials.title")}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("account.credentials.subtitle")}
            </p>
            <div className="mt-4">
              <ResetLinkButton />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              {t("account.notifications.title")}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("account.notifications.subtitle")}
            </p>
            <NotificationPreferences />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
