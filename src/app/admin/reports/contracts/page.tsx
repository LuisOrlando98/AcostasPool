import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import ReportsSectionTabs from "@/components/reports/ReportsSectionTabs";
import ContractsHealthTable from "@/components/reports/ContractsHealthTable";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { startOfCurrentPeriodMonth } from "@/lib/contracts/service";
import { getTranslations } from "@/i18n/server";

type Category = "SIGNED" | "PENDING" | "STALE" | "NONE";

export default async function ContractsReportPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  const currentPeriodMonth = startOfCurrentPeriodMonth();

  const [customers, contracts] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, apellidos: true },
    }),
    prisma.serviceContract.findMany({
      orderBy: [{ periodMonth: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        customerId: true,
        status: true,
        periodMonth: true,
        sentAt: true,
        clientSignedAt: true,
        pdfUrl: true,
      },
    }),
  ]);

  const latestByCustomer = new Map<string, (typeof contracts)[number]>();
  for (const contract of contracts) {
    if (!latestByCustomer.has(contract.customerId)) {
      latestByCustomer.set(contract.customerId, contract);
    }
  }

  const rows = customers.map((customer) => {
    const contract = latestByCustomer.get(customer.id) ?? null;
    const status = contract?.status ?? "NONE";
    const isStale =
      contract !== null &&
      status !== "SIGNED" &&
      contract.periodMonth.getTime() < currentPeriodMonth.getTime();
    const category: Category =
      status === "NONE" ? "NONE" : isStale ? "STALE" : status === "SIGNED" ? "SIGNED" : "PENDING";

    return {
      customerId: customer.id,
      customerName: formatCustomerName(customer),
      status,
      category,
      periodMonth: contract?.periodMonth.toISOString() ?? null,
      sentAt: contract?.sentAt?.toISOString() ?? null,
      signedAt: contract?.clientSignedAt?.toISOString() ?? null,
      pdfUrl: contract?.pdfUrl ?? null,
    };
  });

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
        <ContractsHealthTable rows={rows} />
      </div>
    </AppShell>
  );
}
