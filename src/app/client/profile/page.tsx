import Link from "next/link";
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
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { normalizeEmail } from "@/lib/auth/email";
import { getJobStatusLabel } from "@/lib/constants";

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

async function updateCustomerProperty(formData: FormData) {
  "use server";

  const session = await requireRole("CUSTOMER");
  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });

  if (!customer) {
    return;
  }

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const poolType = String(formData.get("poolType") ?? "").trim();
  const waterType = String(formData.get("waterType") ?? "").trim();
  const sanitizerType = String(formData.get("sanitizerType") ?? "").trim();
  const filterType = String(formData.get("filterType") ?? "").trim();
  const volumeRaw = String(formData.get("poolVolumeGallons") ?? "").trim();
  const hasSpa = String(formData.get("hasSpa") ?? "no") === "yes";
  const accessInfo = String(formData.get("accessInfo") ?? "").trim();
  const locationNotes = String(formData.get("locationNotes") ?? "").trim();

  if (!propertyId || !address) {
    return;
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, customerId: true },
  });

  if (!property || property.customerId !== customer.id) {
    return;
  }

  const parsedVolume = Number(volumeRaw);
  const poolVolumeGallons =
    Number.isFinite(parsedVolume) && parsedVolume > 0
      ? Math.round(parsedVolume)
      : null;

  await prisma.property.update({
    where: { id: property.id },
    data: {
      name: name || null,
      address,
      poolType: poolType || null,
      waterType: waterType || null,
      sanitizerType: sanitizerType || null,
      filterType: filterType || null,
      poolVolumeGallons,
      hasSpa,
      accessInfo: accessInfo || null,
      locationNotes: locationNotes || null,
    },
  });

  revalidatePath("/client/profile");
}

export default async function ClientProfilePage() {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    include: {
      user: {
        select: {
          avatarUrl: true,
        },
      },
      properties: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          jobs: {
            orderBy: [{ completedAt: "desc" }, { scheduledDate: "desc" }],
            take: 6,
            include: { photos: true },
          },
        },
      },
    },
  });

  if (!customer) {
    return (
      <AppShell
        title={t("client.profile.title")}
        subtitle={t("client.profile.subtitle")}
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
      title={t("client.profile.title")}
      subtitle={t("client.profile.subtitle")}
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("client.profile.properties")}</h2>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
            {customer.properties.length}
          </span>
        </div>

        {customer.properties.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            {t("client.profile.noProperties")}
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {customer.properties.map((property) => (
              <form
                key={property.id}
                action={updateCustomerProperty}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
              >
                <input type="hidden" name="propertyId" value={property.id} />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.customers.detail.properties.fields.name")}
                    </label>
                    <input
                      name="name"
                      defaultValue={property.name ?? ""}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.routes.labels.poolType")}
                    </label>
                    <input
                      name="poolType"
                      defaultValue={property.poolType ?? ""}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("address.line1")}
                  </label>
                  <input
                    name="address"
                    defaultValue={property.address}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    required
                  />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.routes.labels.waterType")}
                    </label>
                    <input
                      name="waterType"
                      defaultValue={property.waterType ?? ""}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.routes.labels.filterType")}
                    </label>
                    <input
                      name="filterType"
                      defaultValue={property.filterType ?? ""}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.routes.labels.sanitizerSystem")}
                    </label>
                    <input
                      name="sanitizerType"
                      defaultValue={property.sanitizerType ?? ""}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.routes.labels.poolVolume")}
                    </label>
                    <input
                      name="poolVolumeGallons"
                      type="number"
                      min={0}
                      defaultValue={property.poolVolumeGallons ?? ""}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.customers.detail.properties.fields.spa")}
                    </label>
                    <select
                      name="hasSpa"
                      defaultValue={property.hasSpa ? "yes" : "no"}
                      className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                    >
                      <option value="no">{t("common.labels.no")}</option>
                      <option value="yes">{t("common.labels.yes")}</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.customers.detail.properties.fields.accessInfo")}
                    </label>
                    <textarea
                      name="accessInfo"
                      defaultValue={property.accessInfo ?? ""}
                      className="app-input mt-2 min-h-[90px] w-full px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.customers.detail.properties.fields.locationNotes")}
                    </label>
                    <textarea
                      name="locationNotes"
                      defaultValue={property.locationNotes ?? ""}
                      className="app-input mt-2 min-h-[90px] w-full px-4 py-3 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <FormSubmitButton
                    idleLabel={t("admin.customers.detail.actions.saveProperty")}
                    pendingLabel={t("common.feedback.saving")}
                    successLabel={t("common.feedback.saved")}
                    className="px-5"
                  />
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-800">
                      {t("client.home.recent.title")}
                    </h3>
                    <p className="text-xs text-slate-500">{property.address}</p>
                  </div>
                  {property.jobs.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-slate-500">{t("client.home.recent.empty")}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-semibold">{t("client.home.recent.columns.date")}</th>
                            <th className="px-3 py-2 font-semibold">{t("client.home.recent.columns.type")}</th>
                            <th className="px-3 py-2 font-semibold">{t("client.home.recent.columns.evidence")}</th>
                            <th className="px-3 py-2 font-semibold">{t("client.home.recent.columns.status")}</th>
                            <th className="px-3 py-2 text-right font-semibold">{t("client.home.recent.columns.details")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                          {property.jobs.map((job) => (
                            <tr key={job.id}>
                              <td className="whitespace-nowrap px-3 py-3">
                                {(job.completedAt ?? job.scheduledDate).toLocaleDateString(locale)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3">
                                {job.type === "ON_DEMAND"
                                  ? t("jobs.type.onDemand")
                                  : t("jobs.type.routine")}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3">{job.photos.length}</td>
                              <td className="whitespace-nowrap px-3 py-3">
                                <span className="app-chip inline-flex items-center px-2 py-1 text-[11px]">
                                  {getJobStatusLabel(job.status, t)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <Link
                                  href={`/client/jobs/${job.id}`}
                                  className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                                >
                                  {t("common.actions.view")}
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </form>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
