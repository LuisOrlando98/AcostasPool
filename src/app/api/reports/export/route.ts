import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  buildInvoiceWhere,
  buildJobWhere,
  getReportFilters,
} from "@/lib/reports/filters";
import { formatCustomerName } from "@/lib/customers/format";
import { getPropertyHealthRows } from "@/lib/reports/property-health";
import { getContractStatusRows } from "@/lib/reports/contracts-health";
import { getNeedsAttentionRows } from "@/lib/reports/needs-attention";

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
  const type = url.searchParams.get("type") ?? "jobs";
  const filters = getReportFilters(
    Object.fromEntries(url.searchParams.entries())
  );

  if (type === "property-health") {
    const rows = await getPropertyHealthRows();
    const headers = ["Customer", "Property", "Address", "Flag", "Issues", "Notes", "Updated At"];
    const csvRows = rows.map((row) => [
      row.customerName,
      row.propertyName,
      row.propertyAddress,
      row.flag,
      row.issues.map((issue) => `${issue.label}: ${issue.statusLabel}`).join("; "),
      row.notes ?? "",
      row.updatedAt,
    ]);
    const csv = [headers, ...csvRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="property-health-report.csv"`,
      },
    });
  }

  if (type === "contracts") {
    const rows = await getContractStatusRows();
    const headers = ["Customer", "Status", "Category", "Period", "Sent At", "Signed At"];
    const csvRows = rows.map((row) => [
      row.customerName,
      row.status,
      row.category,
      row.periodMonth ?? "",
      row.sentAt ?? "",
      row.signedAt ?? "",
    ]);
    const csv = [headers, ...csvRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="contracts-report.csv"`,
      },
    });
  }

  if (type === "needs-attention") {
    const rows = await getNeedsAttentionRows();
    const headers = [
      "Customer",
      "Score",
      "Property Issues",
      "Contract Issue",
      "Past Due Autopay",
      "Overdue Invoices Count",
      "Overdue Invoices Total",
    ];
    const csvRows = rows.map((row) => [
      row.customerName,
      row.score.toString(),
      row.propertyIssues
        .map((issue) => `${issue.propertyName} (${issue.issues.join(", ")})`)
        .join("; "),
      row.contractIssue ?? "",
      row.pastDueMembershipCents !== null ? (row.pastDueMembershipCents / 100).toFixed(2) : "",
      row.overdueInvoiceCount.toString(),
      (row.overdueInvoiceTotalCents / 100).toFixed(2),
    ]);
    const csv = [headers, ...csvRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="needs-attention-report.csv"`,
      },
    });
  }

  if (type === "invoices") {
    const invoices = await prisma.invoice.findMany({
      where: buildInvoiceWhere(filters),
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });

    const headers = [
      "Invoice",
      "Customer",
      "Status",
      "Total",
      "Sent At",
      "Paid At",
      "Created At",
    ];
    const rows = invoices.map((invoice) => [
      invoice.number,
      formatCustomerName(invoice.customer),
      invoice.status,
      invoice.total.toString(),
      invoice.sentAt ? invoice.sentAt.toISOString() : "",
      invoice.paidAt ? invoice.paidAt.toISOString() : "",
      invoice.createdAt.toISOString(),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="invoices-report.csv"`,
      },
    });
  }

  const jobs = await prisma.job.findMany({
    where: buildJobWhere(filters),
    orderBy: { scheduledDate: "desc" },
    include: {
      customer: true,
      property: true,
      technician: { include: { user: true } },
    },
  });

  const headers = [
    "Job ID",
    "Customer",
    "Property",
    "Scheduled",
    "Status",
    "Type",
    "Priority",
    "Service",
    "Technician",
  ];
  const rows = jobs.map((job) => [
    job.id,
    formatCustomerName(job.customer),
    job.property?.address ?? "",
    job.scheduledDate.toISOString(),
    job.status,
    job.type,
    job.priority,
    job.serviceType,
    job.technician?.user.fullName ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="jobs-report.csv"`,
    },
  });
}
