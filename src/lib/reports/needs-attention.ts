import { getPropertyHealthRows } from "@/lib/reports/property-health";
import { getContractStatusRows } from "@/lib/reports/contracts-health";
import { getPaymentAttentionRows } from "@/lib/reports/payment-attention";

export type AttentionPropertyIssue = {
  propertyName: string;
  flag: "RED" | "YELLOW";
  issues: string[];
};

export type AttentionRow = {
  customerId: string;
  customerName: string;
  score: number;
  propertyIssues: AttentionPropertyIssue[];
  contractIssue: "STALE" | "NONE" | null;
  pastDueMembershipCents: number | null;
  overdueInvoiceTotalCents: number;
  overdueInvoiceCount: number;
};

export async function getNeedsAttentionRows(options?: {
  customerIds?: string[];
}): Promise<AttentionRow[]> {
  const [propertyRows, contractRows, paymentRows] = await Promise.all([
    getPropertyHealthRows(options),
    getContractStatusRows(options),
    getPaymentAttentionRows(options),
  ]);

  const byCustomer = new Map<string, AttentionRow>();
  const ensure = (customerId: string, customerName: string) => {
    let row = byCustomer.get(customerId);
    if (!row) {
      row = {
        customerId,
        customerName,
        score: 0,
        propertyIssues: [],
        contractIssue: null,
        pastDueMembershipCents: null,
        overdueInvoiceTotalCents: 0,
        overdueInvoiceCount: 0,
      };
      byCustomer.set(customerId, row);
    }
    return row;
  };

  for (const property of propertyRows) {
    if (property.flag !== "RED" && property.flag !== "YELLOW") {
      continue;
    }
    const row = ensure(property.customerId, property.customerName);
    row.propertyIssues.push({
      propertyName: property.propertyName,
      flag: property.flag,
      issues: property.issues.map((issue) => `${issue.label}: ${issue.statusLabel}`),
    });
    row.score += property.flag === "RED" ? 3 : 1;
  }

  for (const contract of contractRows) {
    if (contract.category !== "STALE" && contract.category !== "NONE") {
      continue;
    }
    const row = ensure(contract.customerId, contract.customerName);
    row.contractIssue = contract.category;
    row.score += contract.category === "STALE" ? 2 : 1;
  }

  for (const payment of paymentRows) {
    if (!payment.pastDueMembershipCents && payment.overdueInvoiceCount === 0) {
      continue;
    }
    const row = ensure(payment.customerId, payment.customerName);
    row.pastDueMembershipCents = payment.pastDueMembershipCents;
    row.overdueInvoiceTotalCents = payment.overdueInvoiceTotalCents;
    row.overdueInvoiceCount = payment.overdueInvoiceCount;
    if (payment.pastDueMembershipCents) {
      row.score += 3;
    }
    if (payment.overdueInvoiceCount > 0) {
      row.score += 2;
    }
  }

  return [...byCustomer.values()].sort((a, b) => b.score - a.score);
}
