import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import AppShell from "@/components/layout/AppShell";
import AvatarUpload from "@/components/account/AvatarUpload";
import ResetLinkButton from "@/components/account/ResetLinkButton";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { normalizeUsPhone } from "@/lib/phones";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";
import { normalizeEmail } from "@/lib/auth/email";

async function updateCustomerProfile(formData: FormData) {
  "use server";

  const session = await requireRole("CUSTOMER");
  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: { id: true, userId: true },
  });

  if (!customer) {
    return;
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellidos = String(formData.get("apellidos") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const telefonoRaw = String(formData.get("telefono") ?? "").trim();
  const telefonoSecundarioRaw = String(
    formData.get("telefonoSecundario") ?? ""
  ).trim();
  const idiomaPreferencia =
    String(formData.get("idiomaPreferencia") ?? "EN") === "EN" ? "EN" : "ES";
  const allowWeekendBooking = formData.get("allowWeekendBooking") === "on";
  const direccionLinea1 = String(formData.get("direccionLinea1") ?? "").trim();
  const direccionLinea2 = String(formData.get("direccionLinea2") ?? "").trim();
  const ciudad = String(formData.get("ciudad") ?? "").trim();
  const estadoProvincia = String(formData.get("estadoProvincia") ?? "").trim();
  const codigoPostal = String(formData.get("codigoPostal") ?? "").trim();

  const telefono = normalizeUsPhone(telefonoRaw);
  const telefonoSecundario = telefonoSecundarioRaw
    ? normalizeUsPhone(telefonoSecundarioRaw)
    : null;

  if (!nombre || !apellidos || !email || !telefono) {
    return;
  }

  if (telefonoSecundarioRaw && !telefonoSecundario) {
    return;
  }

  const hasAddress = direccionLinea1 || ciudad || estadoProvincia || codigoPostal;
  if (hasAddress && (!direccionLinea1 || !ciudad || !estadoProvincia || !codigoPostal)) {
    return;
  }

  if (customer.userId) {
    const duplicate = await prisma.user.findFirst({
      where: {
        id: { not: customer.userId },
        email: { equals: email, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (duplicate) {
      return;
    }
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      nombre,
      apellidos,
      email,
      telefono,
      telefonoSecundario,
      idiomaPreferencia,
      allowWeekendBooking,
      direccionLinea1: direccionLinea1 || null,
      direccionLinea2: direccionLinea2 || null,
      ciudad: ciudad || null,
      estadoProvincia: estadoProvincia || null,
      codigoPostal: codigoPostal || null,
    },
  });

  if (customer.userId) {
    await prisma.user.update({
      where: { id: customer.userId },
      data: {
        fullName: `${nombre} ${apellidos}`.trim(),
        email,
        locale: idiomaPreferencia,
      },
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, normalizeLocale(idiomaPreferencia), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  revalidatePath("/client/profile");
  revalidatePath("/client");
}

export default async function ClientProfilePage() {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    include: {
      user: {
        select: {
          avatarUrl: true,
        },
      },
    },
  });

  if (!customer) {
    return (
      <AppShell
        title={t("account.title")}
        subtitle={t("account.subtitle")}
        role="CUSTOMER"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">{t("client.profile.empty")}</p>
        </section>
      </AppShell>
    );
  }

  const customerName = formatCustomerName(customer);
  const statusLabel =
    customer.estadoCuenta === "ACTIVE"
      ? t("common.status.active")
      : t("common.status.inactive");

  return (
    <AppShell
      title={t("account.title")}
      subtitle={t("account.subtitle")}
      role="CUSTOMER"
    >
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {t("roles.client")}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{customerName}</h2>
                <p className="text-sm text-slate-500">{customer.email}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {statusLabel}
              </span>
            </div>

            <form action={updateCustomerProfile} className="mt-5 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  {t("account.profile.title")}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.firstName")}
                    </label>
                    <input
                      name="nombre"
                      defaultValue={customer.nombre}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.lastName")}
                    </label>
                    <input
                      name="apellidos"
                      defaultValue={customer.apellidos}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.email")}
                    </label>
                    <input
                      name="email"
                      type="email"
                      defaultValue={customer.email}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.language")}
                    </label>
                    <select
                      name="idiomaPreferencia"
                      defaultValue={customer.idiomaPreferencia}
                      className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                    >
                      <option value="EN">EN</option>
                      <option value="ES">ES</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.phone")}
                    </label>
                    <input
                      name="telefono"
                      defaultValue={customer.telefono}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.phoneSecondary")}
                    </label>
                    <input
                      name="telefonoSecundario"
                      defaultValue={customer.telefonoSecundario ?? ""}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                </div>
                <label className="mt-3 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                  <input
                    type="checkbox"
                    name="allowWeekendBooking"
                    defaultChecked={customer.allowWeekendBooking}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>{t("admin.customers.new.fields.allowWeekendBooking")}</span>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-sm font-semibold text-slate-800">{t("address.sectionTitle")}</h3>
                <p className="text-xs text-slate-500">{t("address.sectionSubtitle")}</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("address.line1")}
                    </label>
                    <input
                      name="direccionLinea1"
                      defaultValue={customer.direccionLinea1 ?? ""}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("address.line2")}
                    </label>
                    <input
                      name="direccionLinea2"
                      defaultValue={customer.direccionLinea2 ?? ""}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("address.city")}
                      </label>
                      <input
                        name="ciudad"
                        defaultValue={customer.ciudad ?? ""}
                        className="app-input mt-2 w-full px-4 py-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("address.state")}
                      </label>
                      <input
                        name="estadoProvincia"
                        defaultValue={customer.estadoProvincia ?? ""}
                        className="app-input mt-2 w-full px-4 py-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("address.postal")}
                      </label>
                      <input
                        name="codigoPostal"
                        defaultValue={customer.codigoPostal ?? ""}
                        className="app-input mt-2 w-full px-4 py-3 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <FormSubmitButton
                idleLabel={t("common.actions.save")}
                pendingLabel={t("common.feedback.saving")}
                successLabel={t("common.feedback.saved")}
                className="w-full"
              />
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">{t("account.photo.title")}</h2>
            <div className="mt-4">
              <AvatarUpload avatarUrl={customer.user?.avatarUrl ?? null} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">{t("account.credentials.title")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("account.credentials.subtitle")}</p>
            <div className="mt-4">
              <ResetLinkButton />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">{t("account.notifications.title")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("account.notifications.subtitle")}</p>
            <NotificationPreferences />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
