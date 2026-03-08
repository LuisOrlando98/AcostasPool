import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import ServiceAgreementPage from "@/components/agreements/ServiceAgreementPage";
import { requireRole } from "@/lib/auth/guards";
import { getTranslations } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Admin Service Agreement | AcostasPool",
  description:
    "Acuerdo de servicio y resumen funcional para presentacion comercial desde el panel de administracion.",
};

export default async function AdminAgreementServicePage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  return (
    <AppShell
      role="ADMIN"
      title={t("admin.agreement.title")}
      subtitle={t("admin.agreement.subtitle")}
      wide
    >
      <ServiceAgreementPage canonicalPath="/admin/agreement-service" />
    </AppShell>
  );
}
