import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import ReportsSectionTabs from "@/components/reports/ReportsSectionTabs";
import PropertyHealthTable from "@/components/reports/PropertyHealthTable";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { readPoolCondition } from "@/lib/customers/pool-condition";
import { getTranslations } from "@/i18n/server";

export default async function PropertyHealthReportPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  const properties = await prisma.property.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      address: true,
      poolCondition: true,
      poolConditionNotes: true,
      updatedAt: true,
      customerId: true,
      customer: { select: { nombre: true, apellidos: true } },
    },
  });

  const itemLabel = (key: string) =>
    t(`admin.customers.detail.properties.condition.items.${key}`);
  const statusLabel = (status: string) =>
    t(`admin.customers.detail.properties.condition.status.${status}`);

  const rows = properties.map((property) => {
    const entries = readPoolCondition(property.poolCondition);
    const broken = entries.filter((entry) => entry.status === "BROKEN");
    const bad = entries.filter((entry) => entry.status === "BAD");
    const unset = entries.filter((entry) => entry.status === null);
    const flag: "RED" | "YELLOW" | "GREEN" | "UNSET" =
      broken.length > 0
        ? "RED"
        : bad.length > 0
          ? "YELLOW"
          : unset.length === entries.length
            ? "UNSET"
            : "GREEN";

    return {
      propertyId: property.id,
      customerId: property.customerId,
      customerName: formatCustomerName(property.customer),
      propertyName: property.name?.trim() || property.address.trim(),
      propertyAddress: property.address,
      flag,
      issues: [...broken, ...bad].map((entry) => ({
        key: entry.key,
        label: itemLabel(entry.key),
        statusLabel: statusLabel(entry.status as string),
        severity: entry.status as "BROKEN" | "BAD",
      })),
      notes: property.poolConditionNotes,
      updatedAt: property.updatedAt.toISOString(),
    };
  });

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
        <PropertyHealthTable rows={rows} />
      </div>
    </AppShell>
  );
}
