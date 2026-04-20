import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { formatCustomerAddress, formatCustomerName } from "@/lib/customers/format";
import { escapeHtml, renderEmailTemplate } from "@/lib/email-templates";
import { createNotification } from "@/lib/notifications/create";
import { getEmailTemplatesConfig, getInvoiceTemplateConfig } from "@/lib/site-settings";
import { readStoredAsset } from "@/lib/storage/object-store";
import { logAuditEvent } from "@/lib/audit/log";
import { generateInvoicePdf } from "@/lib/invoices/pdf";
import { normalizeInvoiceLineItems } from "@/lib/invoices/line-items";
import { resolveInvoiceTemplateLocale } from "@/lib/invoice-template";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  context: RouteContext
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: invoiceId } = await context.params;
  if (!invoiceId) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!invoice.customer?.email) {
    return NextResponse.json({ error: "Customer email missing" }, { status: 400 });
  }
  const invoiceLocale = resolveInvoiceTemplateLocale(invoice.customer.idiomaPreferencia);
  const customerName = formatCustomerName(invoice.customer);

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    await prisma.emailLog.create({
      data: {
        recipientEmail: invoice.customer.email,
        recipientName: customerName,
        recipientRole: "CUSTOMER",
        subject:
          invoiceLocale === "ES"
            ? `Factura ${invoice.number} (no enviada)`
            : `Invoice ${invoice.number} (not sent)`,
        bodyText: "SMTP not configured",
        status: "FAILED",
        errorMessage: "SMTP not configured",
        customerId: invoice.customerId,
        metadata: {
          category: "INVOICE_SENT",
          invoiceId: invoice.id,
        },
      },
    });
    return NextResponse.json(
      { error: "SMTP not configured" },
      { status: 500 }
    );
  }

  const templates = await getEmailTemplatesConfig(invoiceLocale);
  const rendered = renderEmailTemplate(templates.INVOICE_SENT, {
    customer_name: customerName,
    customer_name_html: escapeHtml(customerName),
    invoice_number: invoice.number,
  });
  const lineItems = normalizeInvoiceLineItems(invoice.lineItems);
  if (lineItems.length === 0) {
    return NextResponse.json({ error: "Invoice line items missing" }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
    });

    const invoiceTemplate = await getInvoiceTemplateConfig();
    const regeneratedPdfUrl = await generateInvoicePdf({
      customerId: invoice.customerId,
      invoiceNumber: invoice.number,
      issueDate: invoice.createdAt,
      customerName,
      customerEmail: invoice.customer.email,
      customerPhone: invoice.customer.telefono,
      customerAddress: formatCustomerAddress(invoice.customer),
      items: lineItems,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      notes: invoice.notes,
      locale: invoiceLocale,
      theme: invoice.theme,
      template: invoiceTemplate,
    });

    const pdfBuffer = await readStoredAsset(regeneratedPdfUrl);

    await transporter.sendMail({
      from,
      to: invoice.customer.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      attachments: [
        {
          filename: `${invoice.number}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        pdfUrl: regeneratedPdfUrl,
      },
    });

    await createNotification({
      customerId: invoice.customerId,
      recipientRole: "CUSTOMER",
      eventType: "INVOICE_SENT",
      severity: "INFO",
      status: "SENT",
      actorUserId: session.sub,
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        email: invoice.customer.email,
      },
    });

    await logAuditEvent({
      userId: session.sub,
      action: "INVOICE_SENT",
      entity: "Invoice",
      entityId: invoice.id,
      metadata: {
        customerId: invoice.customerId,
        email: invoice.customer.email,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Invoice send failed:", error);
    await createNotification({
      customerId: invoice.customerId,
      recipientRole: "CUSTOMER",
      eventType: "INVOICE_SENT",
      severity: "WARNING",
      status: "FAILED",
      actorUserId: session.sub,
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        email: invoice.customer.email,
      },
    });

    await logAuditEvent({
      userId: session.sub,
      action: "INVOICE_SEND_FAILED",
      entity: "Invoice",
      entityId: invoice.id,
      metadata: {
        customerId: invoice.customerId,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
