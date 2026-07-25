import AppShell from "@/components/layout/AppShell";
import ChlorineCalculatorForm from "@/components/pool/ChlorineCalculatorForm";
import { requireDeveloper } from "@/lib/auth/guards";
import { getTranslations } from "@/i18n/server";

export default async function DeveloperPoolCalculatorPage() {
  await requireDeveloper();
  const t = await getTranslations();

  return (
    <AppShell
      role="ADMIN"
      title={t("poolCalculator.title")}
      subtitle={t("poolCalculator.subtitle")}
    >
      <ChlorineCalculatorForm />
    </AppShell>
  );
}
