import AppShell from "@/components/layout/AppShell";
import ChlorineCalculatorForm from "@/components/pool/ChlorineCalculatorForm";
import { requireRole } from "@/lib/auth/guards";
import { getTranslations } from "@/i18n/server";

export default async function TechCalculatorPage() {
  await requireRole("TECH");
  const t = await getTranslations();

  return (
    <AppShell
      title={t("poolCalculator.title")}
      subtitle={t("poolCalculator.subtitle")}
      role="TECH"
    >
      <ChlorineCalculatorForm />
    </AppShell>
  );
}
