import AppShell from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getTranslations } from "@/i18n/server";

export default async function ClientProfilePage() {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    include: { properties: true },
  });

  if (!customer) {
    return (
      <AppShell
        title={t("client.profile.title")}
        subtitle={t("client.profile.subtitle")}
        role="CUSTOMER"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">
            {t("client.profile.empty")}
          </p>
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
      <section className="app-card p-6 shadow-contrast">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{customerName}</h2>
            <p className="text-sm text-slate-500">{customer.email}</p>
          </div>
          <span className="app-chip px-3 py-1 text-xs text-slate-500">
            {statusLabel}
          </span>
        </div>
        <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">
              {t("client.profile.fields.phone")}
            </p>
            <p>{customer.telefono || t("common.labels.notAvailable")}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">
              {t("client.profile.fields.phoneSecondary")}
            </p>
            <p>{customer.telefonoSecundario || t("common.labels.notAvailable")}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">
              {t("client.profile.fields.language")}
            </p>
            <p>
              {customer.idiomaPreferencia === "EN"
                ? t("common.language.en")
                : t("common.language.es")}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">
              {t("client.profile.fields.type")}
            </p>
            <p>
              {customer.tipoCliente === "COMMERCIAL"
                ? t("admin.customers.types.commercial")
                : t("admin.customers.types.residential")}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            {t("client.profile.fields.address")}
          </p>
          <p className="mt-1">
            {customer.direccionLinea1 || t("common.labels.notAvailable")}
          </p>
          {customer.direccionLinea2 ? <p>{customer.direccionLinea2}</p> : null}
          <p className="text-xs text-slate-500">
            {customer.ciudad
              ? `${customer.ciudad}, ${customer.estadoProvincia ?? ""} ${
                  customer.codigoPostal ?? ""
                }`
              : t("client.profile.addressFallback")}
          </p>
        </div>
        <a
          href="/account"
          className="ui-button-ghost mt-4 inline-flex items-center px-4 py-2 text-xs font-semibold"
        >
          {t("client.profile.manageAccount")}
        </a>
      </section>

      <section className="app-card p-6 shadow-contrast">
        <h2 className="text-lg font-semibold">{t("client.profile.properties")}</h2>
        <div className="mt-4 space-y-3">
          {customer.properties.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("client.profile.noProperties")}
            </p>
          ) : (
            customer.properties.map((property) => (
              <div
                key={property.id}
                className="app-callout px-4 py-3"
              >
                <p className="font-medium text-slate-900">{property.address}</p>
                <p className="text-xs text-slate-500">
                  {property.poolType || t("client.profile.property.pool")} ·{" "}
                  {property.waterType || t("client.profile.property.water")} ·{" "}
                  {property.poolVolumeGallons
                    ? `${property.poolVolumeGallons} gal`
                    : t("client.profile.property.volume")}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
