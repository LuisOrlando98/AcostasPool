import AppShell from "@/components/layout/AppShell";
import AvatarUpload from "@/components/account/AvatarUpload";
import AccountSecurityPanel from "@/components/account/AccountSecurityPanel";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";
import { normalizeEmail } from "@/lib/auth/email";
import { redirect } from "next/navigation";

async function updateProfile(formData: FormData) {
  "use server";
  const session = await requireAuth();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const locale = String(formData.get("locale") ?? "EN");
  const techPhone = String(formData.get("techPhone") ?? "").trim();
  const techNotes = String(formData.get("techNotes") ?? "").trim();

  if (!fullName || !email) {
    return;
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, isDeveloper: true },
  });
  if (!currentUser) {
    return;
  }

  const resolvedEmail = currentUser.isDeveloper ? currentUser.email : email;

  if (!currentUser.isDeveloper) {
    const duplicate = await prisma.user.findFirst({
      where: {
        id: { not: session.sub },
        email: { equals: resolvedEmail, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return;
    }
  }

  await prisma.user.update({
    where: { id: session.sub },
    data: {
      fullName,
      email: resolvedEmail,
      locale: locale === "EN" ? "EN" : "ES",
    },
  });

  if (session.role === "CUSTOMER") {
    await prisma.customer.updateMany({
      where: { userId: session.sub },
      data: { idiomaPreferencia: locale === "EN" ? "EN" : "ES" },
    });
  }
  if (session.role === "TECH") {
    await prisma.technician.updateMany({
      where: { userId: session.sub },
      data: {
        phone: techPhone || null,
        notes: techNotes || null,
      },
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, normalizeLocale(locale), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    priority: "medium",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export default async function AccountPage() {
  const session = await requireAuth();
  if (session.role === "CUSTOMER") {
    redirect("/client/profile");
  }
  const t = await getTranslations();
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      technician: true,
      notificationPreferences: {
        where: { eventType: "EMAIL_2FA" },
        select: { enabled: true },
      },
    },
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
      <section className="grid gap-5 xl:gap-6 2xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <div className="min-w-0 space-y-5 xl:space-y-6">
          <div className="app-card p-5 shadow-contrast sm:p-6">
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
                  disabled={user.isDeveloper}
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
              {user.role === "TECH" ? (
                <>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.phone")}
                    </label>
                    <input
                      name="techPhone"
                      defaultValue={user.technician?.phone ?? ""}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.notes")}
                    </label>
                    <textarea
                      name="techNotes"
                      defaultValue={user.technician?.notes ?? ""}
                      rows={4}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                </>
              ) : null}
              <FormSubmitButton
                idleLabel={t("common.actions.save")}
                pendingLabel={t("common.feedback.saving")}
                successLabel={t("common.feedback.saved")}
                className="w-full px-4 py-3"
              />
            </form>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="app-card p-5 shadow-contrast sm:p-6">
              <h2 className="text-lg font-semibold">{t("account.photo.title")}</h2>
              <div className="mt-4">
                <AvatarUpload avatarUrl={user.avatarUrl} />
              </div>
            </div>

            <div className="app-card p-5 shadow-contrast sm:p-6">
              <AccountSecurityPanel
                initialEmail2faEnabled={Boolean(
                  user.notificationPreferences?.[0]?.enabled
                )}
              />
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-5 xl:space-y-6">
          <div className="app-card p-5 shadow-contrast sm:p-6">
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
