import AppShell from "@/components/layout/AppShell";
import ClientProfilePanel from "@/components/account/ClientProfilePanel";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getTranslations } from "@/i18n/server";

export default async function ClientProfilePage() {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    include: {
      user: {
        select: {
          avatarUrl: true,
          notificationPreferences: {
            where: { eventType: "EMAIL_2FA" },
            select: { enabled: true },
            take: 1,
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

  const statusLabel =
    customer.estadoCuenta === "ACTIVE"
      ? t("common.status.active")
      : t("common.status.inactive");

  const initialData = {
    nombre: customer.nombre,
    apellidos: customer.apellidos,
    email: customer.email,
    telefono: customer.telefono,
    telefonoSecundario: customer.telefonoSecundario ?? "",
    idiomaPreferencia: customer.idiomaPreferencia,
    direccionLinea1: customer.direccionLinea1 ?? "",
    direccionLinea2: customer.direccionLinea2 ?? "",
    ciudad: customer.ciudad ?? "",
    estadoProvincia: customer.estadoProvincia ?? "",
    codigoPostal: customer.codigoPostal ?? "",
    avatarUrl: customer.user?.avatarUrl ?? null,
    statusLabel,
    displayName: formatCustomerName(customer),
    email2faEnabled: Boolean(customer.user?.notificationPreferences?.[0]?.enabled),
  };

  return (
    <AppShell
      title={t("client.profile.title")}
      subtitle={t("client.profile.subtitle")}
      role="CUSTOMER"
    >
      <ClientProfilePanel initialData={initialData} />
    </AppShell>
  );
}
