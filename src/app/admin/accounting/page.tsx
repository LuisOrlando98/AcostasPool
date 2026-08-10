import Link from "next/link";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import AccountingSectionTabs from "@/components/accounting/AccountingSectionTabs";
import AccountingFiltersBar from "@/components/accounting/AccountingFiltersBar";
import PastDueMembershipsPanel from "@/components/accounting/PastDueMembershipsPanel";
import {
  RevenueChart,
  MethodBreakdownChart,
  TopCustomersChart,
  MembershipTrendChart,
  InvoiceStatusChart,
} from "@/components/accounting/AccountingCharts";
import { requireRole } from "@/lib/auth/guards";
import { getAccountingDashboardData } from "@/lib/payments/dashboard";
import { getAccountingFilters, formatDateInput } from "@/lib/payments/dashboard-filters";
import { retryMembershipCharge } from "@/lib/payments/retry";
import { cancelMembership } from "@/lib/payments/cancel";
import { revalidateAttentionPaths } from "@/lib/reports/revalidate";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { formatInBusinessTimeZone } from "@/lib/timezone";

async function retryMembershipChargeAction(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  "use server";
  await requireRole("ADMIN");
  const t = await getTranslations();
  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) {
    return { error: t("admin.accounting.pastDue.errors.generic") };
  }

  try {
    await retryMembershipCharge(membershipId);
  } catch (error) {
    console.error("[accounting] retry charge failed", error);
    return { error: t("admin.accounting.pastDue.errors.retryFailed") };
  }

  revalidatePath("/admin/accounting");
  revalidateAttentionPaths();
}

async function cancelPastDueMembershipAction(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  "use server";
  await requireRole("ADMIN");
  const t = await getTranslations();
  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) {
    return { error: t("admin.accounting.pastDue.errors.generic") };
  }

  try {
    await cancelMembership(membershipId, "immediate");
  } catch (error) {
    console.error("[accounting] cancel past-due membership failed", error);
    return { error: t("admin.accounting.pastDue.errors.cancelFailed") };
  }

  revalidatePath("/admin/accounting");
  revalidateAttentionPaths();
}

function money(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function TrendBadge({ pct, positiveIsGood = true }: { pct: number | null; positiveIsGood?: boolean }) {
  if (pct === null) {
    return null;
  }
  const rounded = Math.round(pct * 10) / 10;
  const isPositive = rounded >= 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isGood ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`h-3 w-3 ${isPositive ? "" : "rotate-180"}`}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 15V5m0 0L5 10m5-5l5 5" />
      </svg>
      {Math.abs(rounded)}%
    </span>
  );
}

type AccountingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountingPage({ searchParams }: AccountingPageProps) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const filters = getAccountingFilters(resolvedSearchParams);
  const data = await getAccountingDashboardData(filters);

  const bucketLabels = Object.fromEntries(
    data.revenueSeries.map((point) => {
      if (data.granularity === "day") {
        const date = new Date(`${point.bucket}T00:00:00Z`);
        return [
          point.bucket,
          new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(
            date
          ),
        ];
      }
      const [year, month] = point.bucket.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, 1));
      return [
        point.bucket,
        new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date),
      ];
    })
  );

  const invoiceStatusLabels: Record<string, string> = {
    DRAFT: t("admin.invoices.status.draft"),
    SENT: t("admin.invoices.status.sent"),
    PAID: t("admin.invoices.status.paid"),
    OVERDUE: t("admin.invoices.status.overdue"),
  };

  const membershipHelperParts = [
    data.newMembershipsLast30 > 0
      ? `+${data.newMembershipsLast30} ${t("admin.accounting.stats.newLabel")}`
      : null,
    data.canceledMembershipsLast30 > 0
      ? `-${data.canceledMembershipsLast30} ${t("admin.accounting.stats.canceledLabel")}`
      : null,
  ].filter(Boolean);

  const exportHref = `/api/accounting/export?${new URLSearchParams({
    range: filters.range,
    from: formatDateInput(filters.from),
    to: formatDateInput(filters.to),
  }).toString()}`;

  const reconcileLabel = data.reconcileStatus.lastRunAt
    ? t("admin.accounting.reconcile.status", {
        date: formatInBusinessTimeZone(data.reconcileStatus.lastRunAt, locale, {
          dateStyle: "short",
          timeStyle: "short",
        }),
        checked: String(data.reconcileStatus.checkedCount),
        corrected: String(data.reconcileStatus.correctedCount),
      })
    : t("admin.accounting.reconcile.neverRun");

  return (
    <AppShell
      title={t("admin.accounting.title")}
      subtitle={t("admin.accounting.subtitle")}
      role="ADMIN"
    >
      <div className="mb-4 flex justify-end">
        <AccountingSectionTabs />
      </div>

      <div className="mb-4">
        <AccountingFiltersBar
          defaults={{
            range: filters.range,
            from: formatDateInput(filters.from),
            to: formatDateInput(filters.to),
          }}
          exportHref={exportHref}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("admin.accounting.stats.revenue")}
          value={money(data.totalRevenueCents, locale)}
          helper={t("admin.accounting.stats.revenueHelper")}
          tone="success"
        />
        <StatCard
          label={t("admin.accounting.stats.mrr")}
          value={money(data.mrrCents, locale)}
          helper={
            membershipHelperParts.length > 0
              ? `${membershipHelperParts.join(" / ")} - ${t("admin.accounting.stats.mrrHelper", {
                  count: String(data.activeMembershipCount),
                })}`
              : t("admin.accounting.stats.mrrHelper", {
                  count: String(data.activeMembershipCount),
                })
          }
          tone="info"
        />
        <StatCard
          label={t("admin.accounting.stats.mrrAtRisk")}
          value={money(data.mrrAtRiskCents, locale)}
          helper={t("admin.accounting.stats.mrrAtRiskHelper")}
          tone={data.mrrAtRiskCents > 0 ? "warning" : "success"}
        />
        <StatCard
          label={t("admin.accounting.stats.overdue")}
          value={money(data.overdueInvoiceTotalCents, locale)}
          helper={t("admin.accounting.stats.overdueHelper", {
            count: String(data.overdueInvoiceCount),
          })}
          tone={data.overdueInvoiceCount > 0 ? "danger" : "success"}
        />
      </section>

      <div className="mt-2 flex flex-wrap items-center gap-3 px-1">
        <span className="text-xs font-medium text-slate-500">
          {t("admin.accounting.stats.momentum")}
        </span>
        <TrendBadge pct={data.revenueTrendPct} />
        <span className="text-slate-300">|</span>
        <span className="text-xs text-slate-500">{reconcileLabel}</span>
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <RevenueChart
          data={data.revenueSeries}
          bucketLabels={bucketLabels}
          oneTimeLabel={t("admin.accounting.charts.oneTime")}
          recurringLabel={t("admin.accounting.charts.recurring")}
          totalLabel={t("admin.accounting.charts.revenueTitle")}
          tableViewLabel={t("admin.accounting.charts.tableView")}
          chartViewLabel={t("admin.accounting.charts.chartView")}
        />

        <div className="app-card p-6 shadow-contrast">
          <h2 className="text-base font-semibold text-slate-900">
            {t("admin.accounting.charts.methodTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("admin.accounting.charts.methodSubtitle")}
          </p>
          <div className="mt-4">
            {data.methodBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">{t("admin.accounting.charts.methodEmpty")}</p>
            ) : (
              <MethodBreakdownChart data={data.methodBreakdown} />
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="app-card p-6 shadow-contrast xl:col-span-1">
          <h2 className="text-base font-semibold text-slate-900">
            {t("admin.accounting.charts.topCustomersTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("admin.accounting.charts.topCustomersSubtitle")}
          </p>
          <div className="mt-4">
            {data.topCustomers.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.accounting.charts.topCustomersEmpty")}
              </p>
            ) : (
              <TopCustomersChart data={data.topCustomers} />
            )}
          </div>
        </div>

        <div className="app-card p-6 shadow-contrast xl:col-span-1">
          <h2 className="text-base font-semibold text-slate-900">
            {t("admin.accounting.charts.membershipTrendTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("admin.accounting.charts.membershipTrendSubtitle")}
          </p>
          <div className="mt-4">
            <MembershipTrendChart
              data={data.membershipTrend}
              bucketLabels={bucketLabels}
              activatedLabel={t("admin.accounting.charts.activated")}
              canceledLabel={t("admin.accounting.charts.canceled")}
            />
          </div>
        </div>

        <div className="app-card p-6 shadow-contrast xl:col-span-1">
          <h2 className="text-base font-semibold text-slate-900">
            {t("admin.accounting.charts.invoiceStatusTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("admin.accounting.charts.invoiceStatusSubtitle")}
          </p>
          <div className="mt-4">
            {data.invoiceStatusBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.accounting.charts.invoiceStatusEmpty")}
              </p>
            ) : (
              <InvoiceStatusChart
                data={data.invoiceStatusBreakdown}
                statusLabels={invoiceStatusLabels}
              />
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 app-card p-6 shadow-contrast">
        <h2 className="text-base font-semibold text-slate-900">
          {t("admin.accounting.pastDue.title")}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t("admin.accounting.pastDue.subtitle")}</p>
        <div className="mt-4">
          <PastDueMembershipsPanel
            memberships={data.pastDueMemberships.map((membership) => ({
              id: membership.id,
              customerId: membership.customerId,
              customerName: membership.customerName,
              amountCents: membership.amountCents,
              currentPeriodEnd: membership.currentPeriodEnd
                ? membership.currentPeriodEnd.toISOString()
                : null,
            }))}
            retryAction={retryMembershipChargeAction}
            cancelAction={cancelPastDueMembershipAction}
          />
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="app-card p-6 shadow-contrast">
          <h2 className="text-base font-semibold text-slate-900">
            {t("admin.accounting.recentPayments.title")}
          </h2>
          <div className="mt-4 space-y-2">
            {data.recentPayments.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.accounting.recentPayments.empty")}
              </p>
            ) : (
              data.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{payment.customerName}</p>
                    <p className="text-xs text-slate-500">
                      {formatInBusinessTimeZone(payment.paidAt, locale, {
                        dateStyle: "short",
                      })}{" "}
                      - {payment.method}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      payment.amountCents < 0 ? "text-rose-600" : "text-slate-900"
                    }`}
                  >
                    {money(payment.amountCents, locale)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="app-card p-6 shadow-contrast">
          <h2 className="text-base font-semibold text-slate-900">
            {t("admin.accounting.overdueInvoices.title")}
          </h2>
          <div className="mt-4 space-y-2">
            {data.overdueInvoices.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.accounting.overdueInvoices.empty")}
              </p>
            ) : (
              data.overdueInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/admin/invoices/${invoice.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition hover:border-sky-300"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {invoice.number} - {invoice.customerName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {invoice.sentAt
                        ? formatInBusinessTimeZone(invoice.sentAt, locale, {
                            dateStyle: "short",
                          })
                        : t("admin.accounting.overdueInvoices.notSent")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-rose-600">
                    {money(invoice.totalCents, locale)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
