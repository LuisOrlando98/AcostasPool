import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  buildInvoiceWhere,
  buildJobWhere,
  getReportFilters,
} from "@/lib/reports/filters";
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
  const type = url.searchParams.get("type") ?? "jobs";
  const filters = getReportFilters(
    Object.fromEntries(url.searchParams.entries())
  );

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
