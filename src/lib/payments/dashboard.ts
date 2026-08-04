import { prisma } from "@/lib/db";
import { getStripeReconcileStatus } from "@/lib/site-settings";
import type { AccountingFilters } from "@/lib/payments/dashboard-filters";

export type RevenuePoint = {
  bucket: string;
  oneTimeCents: number;
  recurringCents: number;
  totalCents: number;
};
export type MethodBreakdownPoint = { method: string; amountCents: number };
export type TopCustomerPoint = { customerId: string; customerName: string; amountCents: number };
export type MembershipTrendPoint = { bucket: string; activated: number; canceled: number };
export type InvoiceStatusPoint = { status: string; count: number };
export type PastDueMembership = {
  id: string;
  customerId: string;
  customerName: string;
  amountCents: number;
  currentPeriodEnd: Date | null;
};

export type AccountingDashboardData = {
  granularity: "day" | "month";
  totalRevenueCents: number;
  revenueTrendPct: number | null;
  mrrCents: number;
  mrrAtRiskCents: number;
  activeMembershipCount: number;
  newMembershipsLast30: number;
  canceledMembershipsLast30: number;
  overdueInvoiceCount: number;
  overdueInvoiceTotalCents: number;
  pastDueMembershipCount: number;
  pastDueMemberships: PastDueMembership[];
  revenueSeries: RevenuePoint[];
  methodBreakdown: MethodBreakdownPoint[];
  topCustomers: TopCustomerPoint[];
  membershipTrend: MembershipTrendPoint[];
  invoiceStatusBreakdown: InvoiceStatusPoint[];
  reconcileStatus: {
    lastRunAt: string | null;
    checkedCount: number;
    correctedCount: number;
  };
  recentPayments: Array<{
    id: string;
    customerName: string;
    amountCents: number;
    method: string;
    status: string;
    paidAt: Date;
  }>;
  overdueInvoices: Array<{
    id: string;
    number: string;
    customerName: string;
    totalCents: number;
    sentAt: Date | null;
  }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const GRANULARITY_THRESHOLD_DAYS = 45;
const RECENT_WINDOW_MS = 30 * DAY_MS;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketKeyFor(date: Date, granularity: "day" | "month") {
  return granularity === "day" ? dayKey(date) : monthKey(date);
}

function buildBucketKeys(from: Date, to: Date, granularity: "day" | "month") {
  const keys: string[] = [];
  if (granularity === "day") {
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    while (cursor.getTime() <= end.getTime()) {
      keys.push(dayKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    while (cursor.getTime() <= end.getTime()) {
      keys.push(monthKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return keys;
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export async function getAccountingDashboardData(
  filters: AccountingFilters
): Promise<AccountingDashboardData> {
  const now = new Date();
  const spanMs = Math.max(filters.to.getTime() - filters.from.getTime(), DAY_MS);
  const granularity: "day" | "month" =
    spanMs <= GRANULARITY_THRESHOLD_DAYS * DAY_MS ? "day" : "month";
  const previousFrom = new Date(filters.from.getTime() - spanMs);
  const thirtyDaysAgo = new Date(now.getTime() - RECENT_WINDOW_MS);

  const [
    windowPayments,
    activeMemberships,
    atRiskMemberships,
    pastDueMemberships,
    overdueInvoices,
    recentMemberships,
    trendMemberships,
    invoiceStatusGroups,
    reconcileStatus,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: previousFrom, lte: filters.to } },
      include: { customer: { select: { nombre: true, apellidos: true } } },
      orderBy: { paidAt: "desc" },
    }),
    prisma.membership.findMany({
      where: { status: "ACTIVE" },
      select: { amountCents: true, cancelAtPeriodEnd: true },
    }),
    prisma.membership.aggregate({
      where: { status: "ACTIVE", cancelAtPeriodEnd: true },
      _sum: { amountCents: true },
    }),
    prisma.membership.findMany({
      where: { status: "PAST_DUE" },
      include: { customer: { select: { nombre: true, apellidos: true } } },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE"] } },
      include: { customer: { select: { nombre: true, apellidos: true } } },
      orderBy: { sentAt: "asc" },
      take: 20,
    }),
    prisma.membership.findMany({
      where: {
        OR: [{ authorizedAt: { gte: thirtyDaysAgo } }, { canceledAt: { gte: thirtyDaysAgo } }],
      },
      select: { authorizedAt: true, canceledAt: true },
    }),
    prisma.membership.findMany({
      where: {
        OR: [
          { authorizedAt: { gte: filters.from, lte: filters.to } },
          { canceledAt: { gte: filters.from, lte: filters.to } },
        ],
      },
      select: { authorizedAt: true, canceledAt: true },
    }),
    prisma.invoice.groupBy({ by: ["status"], _count: { _all: true } }),
    getStripeReconcileStatus(),
  ]);

  const bucketKeys = buildBucketKeys(filters.from, filters.to, granularity);
  const revenueBuckets = new Map<string, { oneTimeCents: number; recurringCents: number }>();
  for (const key of bucketKeys) {
    revenueBuckets.set(key, { oneTimeCents: 0, recurringCents: 0 });
  }

  const methodTotals = new Map<string, number>();
  const customerTotals = new Map<string, { name: string; amountCents: number }>();
  let currentWindowTotalCents = 0;
  let previousWindowTotalCents = 0;

  for (const payment of windowPayments) {
    const inCurrentWindow = payment.paidAt >= filters.from;

    if (inCurrentWindow) {
      currentWindowTotalCents += payment.amountCents;
      const bucket = revenueBuckets.get(bucketKeyFor(payment.paidAt, granularity));
      if (bucket) {
        if (payment.membershipId) {
          bucket.recurringCents += payment.amountCents;
        } else {
          bucket.oneTimeCents += payment.amountCents;
        }
      }

      if (payment.status === "SUCCEEDED") {
        methodTotals.set(
          payment.method,
          (methodTotals.get(payment.method) ?? 0) + payment.amountCents
        );
        const customerName = `${payment.customer.nombre} ${payment.customer.apellidos}`.trim();
        const existing = customerTotals.get(payment.customerId);
        customerTotals.set(payment.customerId, {
          name: customerName,
          amountCents: (existing?.amountCents ?? 0) + payment.amountCents,
        });
      }
    } else {
      previousWindowTotalCents += payment.amountCents;
    }
  }

  const revenueSeries: RevenuePoint[] = bucketKeys.map((bucket) => {
    const point = revenueBuckets.get(bucket) ?? { oneTimeCents: 0, recurringCents: 0 };
    return {
      bucket,
      oneTimeCents: point.oneTimeCents,
      recurringCents: point.recurringCents,
      totalCents: point.oneTimeCents + point.recurringCents,
    };
  });

  const methodBreakdown: MethodBreakdownPoint[] = Array.from(methodTotals.entries())
    .map(([method, amountCents]) => ({ method, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);

  const topCustomers: TopCustomerPoint[] = Array.from(customerTotals.entries())
    .map(([customerId, { name, amountCents }]) => ({
      customerId,
      customerName: name,
      amountCents,
    }))
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 6);

  const membershipTrendBuckets = new Map<string, { activated: number; canceled: number }>();
  for (const key of bucketKeys) {
    membershipTrendBuckets.set(key, { activated: 0, canceled: 0 });
  }
  for (const membership of trendMemberships) {
    if (membership.authorizedAt) {
      const bucket = membershipTrendBuckets.get(bucketKeyFor(membership.authorizedAt, granularity));
      if (bucket) {
        bucket.activated += 1;
      }
    }
    if (membership.canceledAt) {
      const bucket = membershipTrendBuckets.get(bucketKeyFor(membership.canceledAt, granularity));
      if (bucket) {
        bucket.canceled += 1;
      }
    }
  }
  const membershipTrend: MembershipTrendPoint[] = bucketKeys.map((bucket) => ({
    bucket,
    ...(membershipTrendBuckets.get(bucket) ?? { activated: 0, canceled: 0 }),
  }));

  const overdueInvoiceTotalCents = overdueInvoices.reduce(
    (sum, invoice) => sum + Math.round(Number(invoice.total) * 100),
    0
  );

  return {
    granularity,
    totalRevenueCents: currentWindowTotalCents,
    revenueTrendPct: pctChange(currentWindowTotalCents, previousWindowTotalCents),
    mrrCents: activeMemberships.reduce((sum, item) => sum + item.amountCents, 0),
    mrrAtRiskCents: atRiskMemberships._sum.amountCents ?? 0,
    activeMembershipCount: activeMemberships.length,
    newMembershipsLast30: recentMemberships.filter(
      (m) => m.authorizedAt && m.authorizedAt >= thirtyDaysAgo
    ).length,
    canceledMembershipsLast30: recentMemberships.filter(
      (m) => m.canceledAt && m.canceledAt >= thirtyDaysAgo
    ).length,
    overdueInvoiceCount: overdueInvoices.length,
    overdueInvoiceTotalCents,
    pastDueMembershipCount: pastDueMemberships.length,
    pastDueMemberships: pastDueMemberships.map((membership) => ({
      id: membership.id,
      customerId: membership.customerId,
      customerName: `${membership.customer.nombre} ${membership.customer.apellidos}`.trim(),
      amountCents: membership.amountCents,
      currentPeriodEnd: membership.currentPeriodEnd,
    })),
    revenueSeries,
    methodBreakdown,
    topCustomers,
    membershipTrend,
    invoiceStatusBreakdown: invoiceStatusGroups.map((group) => ({
      status: group.status,
      count: group._count._all,
    })),
    reconcileStatus,
    recentPayments: windowPayments
      .filter((payment) => payment.paidAt >= filters.from)
      .slice(0, 10)
      .map((payment) => ({
        id: payment.id,
        customerName: `${payment.customer.nombre} ${payment.customer.apellidos}`.trim(),
        amountCents: payment.amountCents,
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt,
      })),
    overdueInvoices: overdueInvoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      customerName: `${invoice.customer.nombre} ${invoice.customer.apellidos}`.trim(),
      totalCents: Math.round(Number(invoice.total) * 100),
      sentAt: invoice.sentAt,
    })),
  };
}
