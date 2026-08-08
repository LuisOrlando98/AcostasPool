import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import ReportsSectionTabs from "@/components/reports/ReportsSectionTabs";
import PropertyHealthTable from "@/components/reports/PropertyHealthTable";
import { requireRole } from "@/lib/auth/guards";
import { getPropertyHealthRows } from "@/lib/reports/property-health";
import { getTranslations } from "@/i18n/server";

export default async function PropertyHealthReportPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  const rows = await getPropertyHealthRows();

  const redCount = rows.filter((row) => row.flag === "RED").length;
  const yellowCount = rows.filter((row) => row.flag === "YELLOW").length;
  const greenCount = rows.filter((row) => row.flag === "GREEN").length;
  const unsetCount = rows.filter((row) => row.flag === "UNSET").length;

  return (
    <AppShell
      title={t("admin.reports.propertyHealth.title")}
      subtitle={t("admin.reports.propertyHealth.subtitle")}
      role="ADMIN"
    >
      <div className="mb-4 flex justify-end overflow-x-auto">
        <ReportsSectionTabs />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("admin.reports.propertyHealth.stats.critical")}
          value={String(redCount)}
          helper={t("admin.reports.propertyHealth.stats.criticalHelper")}
          tone={redCount > 0 ? "danger" : "success"}
        />
        <StatCard
          label={t("admin.reports.propertyHealth.stats.warning")}
          value={String(yellowCount)}
          helper={t("admin.reports.propertyHealth.stats.warningHelper")}
          tone={yellowCount > 0 ? "warning" : "success"}
        />
        <StatCard
          label={t("admin.reports.propertyHealth.stats.good")}
          value={String(greenCount)}
          helper={t("admin.reports.propertyHealth.stats.goodHelper")}
          tone="success"
        />
        <StatCard
          label={t("admin.reports.propertyHealth.stats.unset")}
          value={String(unsetCount)}
          helper={t("admin.reports.propertyHealth.stats.unsetHelper")}
          tone="info"
        />
      </section>

      <div className="mt-6">
        <PropertyHealthTable rows={rows} exportHref="/api/reports/export?type=property-health" />
      </div>
    </AppShell>
  );
}
