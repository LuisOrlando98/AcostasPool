import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ServiceAgreementPage from "@/components/agreements/ServiceAgreementPage";
import { requireRole } from "@/lib/auth/guards";
import { isDeveloperEmail } from "@/lib/auth/developer";
import { getTranslations } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Admin Service Agreement | AcostasPool",
  description:
    "Acuerdo de servicio y resumen funcional para presentacion comercial desde el panel de administracion.",
};

export default async function AdminAgreementServicePage() {
  const session = await requireRole("ADMIN");
  if (!isDeveloperEmail(session.email)) {
    redirect("/unauthorized?next=/admin");
  }
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
