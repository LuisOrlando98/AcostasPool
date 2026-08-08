import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import ReportsSectionTabs from "@/components/reports/ReportsSectionTabs";
import ContractsHealthTable from "@/components/reports/ContractsHealthTable";
import { requireRole } from "@/lib/auth/guards";
import { getContractStatusRows } from "@/lib/reports/contracts-health";
import { getTranslations } from "@/i18n/server";

export default async function ContractsReportPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  const rows = await getContractStatusRows();

  const signedCount = rows.filter((row) => row.category === "SIGNED").length;
  const pendingCount = rows.filter((row) => row.category === "PENDING").length;
  const staleCount = rows.filter((row) => row.category === "STALE").length;
  const noneCount = rows.filter((row) => row.category === "NONE").length;

  return (
    <AppShell
      title={t("admin.reports.contracts.title")}
      subtitle={t("admin.reports.contracts.subtitle")}
      role="ADMIN"
    >
      <div className="mb-4 flex justify-end overflow-x-auto">
        <ReportsSectionTabs />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("admin.reports.contracts.stats.signed")}
          value={String(signedCount)}
          helper={t("admin.reports.contracts.stats.signedHelper")}
          tone="success"
        />
        <StatCard
          label={t("admin.reports.contracts.stats.pending")}
          value={String(pendingCount)}
          helper={t("admin.reports.contracts.stats.pendingHelper")}
          tone="info"
        />
        <StatCard
          label={t("admin.reports.contracts.stats.stale")}
          value={String(staleCount)}
          helper={t("admin.reports.contracts.stats.staleHelper")}
          tone={staleCount > 0 ? "danger" : "success"}
        />
        <StatCard
          label={t("admin.reports.contracts.stats.none")}
          value={String(noneCount)}
          helper={t("admin.reports.contracts.stats.noneHelper")}
          tone={noneCount > 0 ? "warning" : "success"}
        />
      </section>

      <div className="mt-6">
        <ContractsHealthTable rows={rows} exportHref="/api/reports/export?type=contracts" />
      </div>
    </AppShell>
  );
}
