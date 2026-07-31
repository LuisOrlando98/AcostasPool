import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import {
  RevenueChart,
  MethodBreakdownChart,
  TopCustomersChart,
  MembershipTrendChart,
  InvoiceStatusChart,
} from "@/components/accounting/AccountingCharts";
import { requireRole } from "@/lib/auth/guards";
import { getAccountingDashboardData } from "@/lib/payments/dashboard";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { formatInBusinessTimeZone } from "@/lib/timezone";

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

export default async function AccountingPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const data = await getAccountingDashboardData();

  const monthLabels = Object.fromEntries(
    data.revenueSeries.map((point) => {
      const [year, month] = point.month.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, 1));
      return [
        point.month,
        new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date),
      ];
    })
  );
  const membershipMonthLabels = Object.fromEntries(
    data.membershipTrend.map((point) => {
      const [year, month] = point.month.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, 1));
      return [
        point.month,
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

  return (
    <AppShell
      title={t("admin.accounting.title")}
      subtitle={t("admin.accounting.subtitle")}
      role="ADMIN"
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("admin.accounting.stats.revenue12mo")}
          value={money(data.totalRevenue12moCents, locale)}
          helper={t("admin.accounting.stats.revenue12moHelper")}
          tone="success"
          className="relative"
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
          label={t("admin.accounting.stats.overdue")}
          value={money(data.overdueInvoiceTotalCents, locale)}
          helper={t("admin.accounting.stats.overdueHelper", {
            count: String(data.overdueInvoiceCount),
          })}
          tone={data.overdueInvoiceCount > 0 ? "danger" : "success"}
        />
        <StatCard
          label={t("admin.accounting.stats.pastDue")}
          value={String(data.pastDueMembershipCount)}
          helper={t("admin.accounting.stats.pastDueHelper")}
          tone={data.pastDueMembershipCount > 0 ? "warning" : "success"}
        />
      </section>

      <div className="mt-2 flex items-center gap-2 px-1">
        <span className="text-xs font-medium text-slate-500">
          {t("admin.accounting.stats.momentum")}
        </span>
        <TrendBadge pct={data.revenueTrendPct} />
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <RevenueChart
          data={data.revenueSeries}
          monthLabels={monthLabels}
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
              monthLabels={membershipMonthLabels}
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
