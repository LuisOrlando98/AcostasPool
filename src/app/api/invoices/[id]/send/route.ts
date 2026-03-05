import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { formatCustomerAddress, formatCustomerName } from "@/lib/customers/format";
import { escapeHtml, renderEmailTemplate } from "@/lib/email-templates";
import { createNotification } from "@/lib/notifications/create";
import { getInvoiceTemplateConfig } from "@/lib/site-settings";
import { readStoredAsset } from "@/lib/storage/object-store";
import { logAuditEvent } from "@/lib/audit/log";
import { generateInvoicePdf } from "@/lib/invoices/pdf";
import { normalizeInvoiceLineItems } from "@/lib/invoices/line-items";
import { resolveInvoiceTemplateLocale } from "@/lib/invoice-template";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getInvoiceEmailTemplateByLocale(locale: "EN" | "ES") {
  if (locale === "ES") {
    return {
      subject: "Tu factura de AcostasPool {{invoice_number}}",
      text: [
        "Hola {{customer_name}},",
        "",
        "Adjuntamos tu factura {{invoice_number}} en PDF.",
        "Por favor revisa los detalles y guarda este correo para tus registros.",
        "",
        "Gracias por elegir AcostasPool.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<h2 style="margin:0 0 10px;color:#0b1f35;">Factura {{invoice_number}}</h2>',
        '<p style="margin:0 0 12px;color:#334155;">Hola {{customer_name_html}}, tu factura esta adjunta a este correo.</p>',
        '<p style="margin:0;color:#64748b;font-size:13px;">Gracias por elegir AcostasPool.</p>',
        "</div>",
      ].join(""),
    };
  }

  return {
    subject: "Your AcostasPool invoice {{invoice_number}}",
    text: [
      "Hi {{customer_name}},",
      "",
      "Your invoice {{invoice_number}} is attached to this email as PDF.",
      "Please review the details and keep this message for your records.",
      "",
      "Thank you for choosing AcostasPool.",
    ].join("\n"),
    html: [
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
      '<h2 style="margin:0 0 10px;color:#0b1f35;">Invoice {{invoice_number}}</h2>',
      '<p style="margin:0 0 12px;color:#334155;">Hi {{customer_name_html}}, your invoice is attached to this email.</p>',
      '<p style="margin:0;color:#64748b;font-size:13px;">Thank you for choosing AcostasPool.</p>',
      "</div>",
    ].join(""),
  };
}

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

  const rendered = renderEmailTemplate(getInvoiceEmailTemplateByLocale(invoiceLocale), {
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
