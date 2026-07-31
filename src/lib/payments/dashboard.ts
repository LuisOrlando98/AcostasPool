import { prisma } from "@/lib/db";

export type RevenuePoint = {
  month: string;
  oneTimeCents: number;
  recurringCents: number;
  totalCents: number;
};
export type MethodBreakdownPoint = { method: string; amountCents: number };
export type TopCustomerPoint = { customerId: string; customerName: string; amountCents: number };
export type MembershipTrendPoint = { month: string; activated: number; canceled: number };
export type InvoiceStatusPoint = { status: string; count: number };

export type AccountingDashboardData = {
  totalRevenue12moCents: number;
  revenueTrendPct: number | null;
  mrrCents: number;
  activeMembershipCount: number;
  newMembershipsLast30: number;
  canceledMembershipsLast30: number;
  overdueInvoiceCount: number;
  overdueInvoiceTotalCents: number;
  pastDueMembershipCount: number;
  revenueSeries: RevenuePoint[];
  methodBreakdown: MethodBreakdownPoint[];
  topCustomers: TopCustomerPoint[];
  membershipTrend: MembershipTrendPoint[];
  invoiceStatusBreakdown: InvoiceStatusPoint[];
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

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export async function getAccountingDashboardData(): Promise<AccountingDashboardData> {
  const now = new Date();
  const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [
    payments,
    activeMemberships,
    pastDueMembershipCount,
    overdueInvoices,
    recentMemberships,
    invoiceStatusGroups,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: twelveMonthsAgo } },
      include: { customer: { select: { nombre: true, apellidos: true } } },
      orderBy: { paidAt: "desc" },
    }),
    prisma.membership.findMany({
      where: { status: "ACTIVE" },
      select: { amountCents: true },
    }),
    prisma.membership.count({ where: { status: "PAST_DUE" } }),
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE"] } },
      include: { customer: { select: { nombre: true, apellidos: true } } },
      orderBy: { sentAt: "asc" },
      take: 20,
    }),
    prisma.membership.findMany({
      where: {
        OR: [{ authorizedAt: { gte: sixMonthsAgo } }, { canceledAt: { gte: sixMonthsAgo } }],
      },
      select: { authorizedAt: true, canceledAt: true },
    }),
    prisma.invoice.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const monthBuckets = new Map<string, { oneTimeCents: number; recurringCents: number }>();
  for (let i = 0; i < 12; i += 1) {
    const bucketDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1));
    monthBuckets.set(monthKey(bucketDate), { oneTimeCents: 0, recurringCents: 0 });
  }

  const methodTotals = new Map<string, number>();
  const customerTotals = new Map<string, { name: string; amountCents: number }>();
  let totalRevenue12moCents = 0;
  let last30Cents = 0;
  let prior30Cents = 0;

  for (const payment of payments) {
    totalRevenue12moCents += payment.amountCents;

    const key = monthKey(payment.paidAt);
    const bucket = monthBuckets.get(key);
    if (bucket) {
      if (payment.membershipId) {
        bucket.recurringCents += payment.amountCents;
      } else {
        bucket.oneTimeCents += payment.amountCents;
      }
    }

    if (payment.paidAt >= thirtyDaysAgo) {
      last30Cents += payment.amountCents;
    } else if (payment.paidAt >= sixtyDaysAgo) {
      prior30Cents += payment.amountCents;
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
  }

  const revenueSeries: RevenuePoint[] = Array.from(monthBuckets.entries()).map(
    ([month, { oneTimeCents, recurringCents }]) => ({
      month,
      oneTimeCents,
      recurringCents,
      totalCents: oneTimeCents + recurringCents,
    })
  );

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
  for (let i = 0; i < 6; i += 1) {
    const bucketDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    membershipTrendBuckets.set(monthKey(bucketDate), { activated: 0, canceled: 0 });
  }
  for (const membership of recentMemberships) {
    if (membership.authorizedAt) {
      const bucket = membershipTrendBuckets.get(monthKey(membership.authorizedAt));
      if (bucket) {
        bucket.activated += 1;
      }
    }
    if (membership.canceledAt) {
      const bucket = membershipTrendBuckets.get(monthKey(membership.canceledAt));
      if (bucket) {
        bucket.canceled += 1;
      }
    }
  }
  const membershipTrend: MembershipTrendPoint[] = Array.from(
    membershipTrendBuckets.entries()
  ).map(([month, { activated, canceled }]) => ({ month, activated, canceled }));

  const overdueInvoiceTotalCents = overdueInvoices.reduce(
    (sum, invoice) => sum + Math.round(Number(invoice.total) * 100),
    0
  );

  return {
    totalRevenue12moCents,
    revenueTrendPct: pctChange(last30Cents, prior30Cents),
    mrrCents: activeMemberships.reduce((sum, item) => sum + item.amountCents, 0),
    activeMembershipCount: activeMemberships.length,
    newMembershipsLast30: recentMemberships.filter(
      (m) => m.authorizedAt && m.authorizedAt >= thirtyDaysAgo
    ).length,
    canceledMembershipsLast30: recentMemberships.filter(
      (m) => m.canceledAt && m.canceledAt >= thirtyDaysAgo
    ).length,
    overdueInvoiceCount: overdueInvoices.length,
    overdueInvoiceTotalCents,
    pastDueMembershipCount,
    revenueSeries,
    methodBreakdown,
    topCustomers,
    membershipTrend,
    invoiceStatusBreakdown: invoiceStatusGroups.map((group) => ({
      status: group.status,
      count: group._count._all,
    })),
    recentPayments: payments.slice(0, 10).map((payment) => ({
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
