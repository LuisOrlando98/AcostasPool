import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";

export type PaymentAttentionRow = {
  customerId: string;
  customerName: string;
  pastDueMembershipCents: number | null;
  overdueInvoiceTotalCents: number;
  overdueInvoiceCount: number;
};

export async function getPaymentAttentionRows(options?: {
  customerIds?: string[];
}): Promise<PaymentAttentionRow[]> {
  const customerIdFilter = options?.customerIds ? { in: options.customerIds } : undefined;

  const [pastDueMemberships, overdueInvoices] = await Promise.all([
    prisma.membership.findMany({
      where: {
        status: "PAST_DUE",
        ...(customerIdFilter ? { customerId: customerIdFilter } : {}),
      },
      select: {
        customerId: true,
        amountCents: true,
        customer: { select: { nombre: true, apellidos: true } },
      },
    }),
    prisma.invoice.findMany({
      where: {
        status: "OVERDUE",
        ...(customerIdFilter ? { customerId: customerIdFilter } : {}),
      },
      select: {
        customerId: true,
        total: true,
        customer: { select: { nombre: true, apellidos: true } },
      },
    }),
  ]);

  const byCustomer = new Map<string, PaymentAttentionRow>();
  const ensure = (customerId: string, customer: { nombre: string; apellidos: string }) => {
    let row = byCustomer.get(customerId);
    if (!row) {
      row = {
        customerId,
        customerName: formatCustomerName(customer),
        pastDueMembershipCents: null,
        overdueInvoiceTotalCents: 0,
        overdueInvoiceCount: 0,
      };
      byCustomer.set(customerId, row);
    }
    return row;
  };

  for (const membership of pastDueMemberships) {
    const row = ensure(membership.customerId, membership.customer);
    row.pastDueMembershipCents = (row.pastDueMembershipCents ?? 0) + membership.amountCents;
  }
  for (const invoice of overdueInvoices) {
    const row = ensure(invoice.customerId, invoice.customer);
    row.overdueInvoiceTotalCents += Math.round(Number(invoice.total) * 100);
    row.overdueInvoiceCount += 1;
  }

  return [...byCustomer.values()];
}
