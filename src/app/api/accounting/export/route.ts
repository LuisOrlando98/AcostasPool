import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getAccountingFilters } from "@/lib/payments/dashboard-filters";
import { formatCustomerName } from "@/lib/customers/format";

const escapeCsv = (value: unknown) => {
  const safe = String(value ?? "");
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = getAccountingFilters(Object.fromEntries(url.searchParams.entries()));

  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: filters.from, lte: filters.to } },
    orderBy: { paidAt: "desc" },
    include: { customer: true, invoice: { select: { number: true } } },
  });

  const headers = [
    "Date",
    "Customer",
    "Amount",
    "Currency",
    "Status",
    "Method",
    "Source",
    "Invoice",
  ];
  const rows = payments.map((payment) => [
    payment.paidAt.toISOString(),
    formatCustomerName(payment.customer),
    (payment.amountCents / 100).toFixed(2),
    payment.currency.toUpperCase(),
    payment.status,
    payment.method,
    payment.membershipId ? "Autopay membership" : "One-time payment",
    payment.invoice?.number ?? "",
  ]);

  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="payments-export.csv"`,
    },
  });
}
