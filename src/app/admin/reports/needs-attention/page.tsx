import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import ReportsSectionTabs from "@/components/reports/ReportsSectionTabs";
import NeedsAttentionTable from "@/components/reports/NeedsAttentionTable";
import { requireRole } from "@/lib/auth/guards";
import { getNeedsAttentionRows } from "@/lib/reports/needs-attention";
import { getTranslations } from "@/i18n/server";

export default async function NeedsAttentionReportPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  const rows = await getNeedsAttentionRows();

  const criticalCount = rows.filter((row) => row.score >= 3).length;
  const propertyIssueCount = rows.filter((row) => row.propertyIssues.length > 0).length;
  const contractIssueCount = rows.filter((row) => row.contractIssue !== null).length;
  const paymentIssueCount = rows.filter(
    (row) => row.pastDueMembershipCents !== null || row.overdueInvoiceCount > 0
  ).length;

  return (
    <AppShell
      title={t("admin.reports.needsAttention.title")}
      subtitle={t("admin.reports.needsAttention.subtitle")}
      role="ADMIN"
    >
      <div className="mb-4 flex justify-end overflow-x-auto">
        <ReportsSectionTabs />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("admin.reports.needsAttention.stats.total")}
          value={String(rows.length)}
          helper={t("admin.reports.needsAttention.stats.totalHelper")}
          tone={rows.length > 0 ? "warning" : "success"}
        />
        <StatCard
          label={t("admin.reports.needsAttention.stats.critical")}
          value={String(criticalCount)}
          helper={t("admin.reports.needsAttention.stats.criticalHelper")}
          tone={criticalCount > 0 ? "danger" : "success"}
        />
        <StatCard
          label={t("admin.reports.needsAttention.stats.payment")}
          value={String(paymentIssueCount)}
          helper={t("admin.reports.needsAttention.stats.paymentHelper")}
          tone={paymentIssueCount > 0 ? "danger" : "success"}
        />
        <StatCard
          label={t("admin.reports.needsAttention.stats.property")}
          value={String(propertyIssueCount)}
          helper={t("admin.reports.needsAttention.stats.propertyHelper", {
            count: contractIssueCount,
          })}
          tone={propertyIssueCount > 0 ? "warning" : "success"}
        />
      </section>

      <div className="mt-6">
        <NeedsAttentionTable rows={rows} exportHref="/api/reports/export?type=needs-attention" />
      </div>
    </AppShell>
  );
}
