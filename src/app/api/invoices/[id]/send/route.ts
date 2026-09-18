import { NextResponse } from "next/server";
import type { Customer, Invoice } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/log";
import { formatCustomerAddress, formatCustomerName } from "@/lib/customers/format";
import { escapeHtml, renderEmailTemplate } from "@/lib/email-templates";
import {
  resolveInvoiceTemplateLocale,
  type InvoiceTemplateLocale,
} from "@/lib/invoice-template";
import {
  normalizeInvoiceLineItems,
  type EditableInvoiceLineItem,
} from "@/lib/invoices/line-items";
import { generateInvoicePdf } from "@/lib/invoices/pdf";
import { getMailConfig, sendMailAndLog, summarizeError } from "@/lib/mail/transport";
import { createNotification } from "@/lib/notifications/create";
import { publishNotification } from "@/lib/notifications/realtime";
import { getEmailTemplatesConfig, getInvoiceTemplateConfig } from "@/lib/site-settings";
import { readStoredAsset } from "@/lib/storage/object-store";
import { getPublicAppUrl } from "@/lib/app-url";
import { issueInvoicePaymentToken } from "@/lib/payments/invoice-token";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SendOptions = { force: boolean };

type SendContext = {
  actorUserId: string;
  invoice: Invoice;
  customer: Customer;
  customerEmail: string;
};

type PdfResult =
  | { ok: true; url: string; buffer: Buffer }
  | { ok: false; error: string };

const ALREADY_SENT_ERROR = "already_sent";
const POST_SEND_FAILED_WARNING = "post_send_failed";
const INVOICE_SENT_EVENT = "INVOICE_SENT";

const sendOptionsSchema = z.object({ force: z.boolean().optional() });

/**
 * The body is optional: no body means a regular send, `{ "force": true }`
 * re-sends an invoice that is already marked SENT.
 */
async function parseSendOptions(request: Request): Promise<SendOptions | null> {
  const rawBody = await request.text().catch(() => "");
  if (!rawBody.trim()) {
    return { force: false };
  }
  try {
    const parsed = sendOptionsSchema.safeParse(JSON.parse(rawBody));
    return parsed.success ? { force: parsed.data.force === true } : null;
  } catch {
    return null;
  }
}

function buildUnsentSubject(invoiceNumber: string, locale: InvoiceTemplateLocale): string {
  return locale === "ES"
    ? `Factura ${invoiceNumber} (no enviada)`
    : `Invoice ${invoiceNumber} (not sent)`;
}

async function regenerateInvoicePdf(input: {
  invoice: Invoice;
  customer: Customer;
  customerName: string;
  lineItems: EditableInvoiceLineItem[];
  locale: InvoiceTemplateLocale;
}): Promise<PdfResult> {
  const { invoice, customer, customerName, lineItems, locale } = input;
  try {
    const invoiceTemplate = await getInvoiceTemplateConfig();
    const url = await generateInvoicePdf({
      customerId: invoice.customerId,
      invoiceNumber: invoice.number,
      issueDate: invoice.createdAt,
      customerName,
      customerEmail: customer.email,
      customerPhone: customer.telefono,
      customerAddress: formatCustomerAddress(customer),
      items: lineItems,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      notes: invoice.notes,
      locale,
      theme: invoice.theme,
      template: invoiceTemplate,
    });
    const buffer = await readStoredAsset(url);
    return { ok: true, url, buffer };
  } catch (error) {
    console.error("Invoice PDF generation failed:", error);
    return { ok: false, error: summarizeError(error) };
  }
}

/** Pre-send failure: nothing reached the customer, so record it and let the admin retry. */
async function respondSendFailure(context: SendContext, error: string) {
  const { actorUserId, invoice, customerEmail } = context;
  await createNotification({
    customerId: invoice.customerId,
    recipientRole: "CUSTOMER",
    eventType: INVOICE_SENT_EVENT,
    severity: "WARNING",
    status: "FAILED",
    actorUserId,
    payload: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      email: customerEmail,
    },
  });
  await logAuditEvent({
    userId: actorUserId,
    action: "INVOICE_SEND_FAILED",
    entity: "Invoice",
    entityId: invoice.id,
    metadata: { customerId: invoice.customerId, error },
  });
  return NextResponse.json({ error: "Send failed" }, { status: 500 });
}

/**
 * Post-send bookkeeping: invoice status, customer notification and audit entry
 * are committed atomically, then the realtime event is published. The email is
 * already out, so a failure here is reported as a warning instead of a 500.
 */
async function finalizeSentInvoice(
  context: SendContext,
  pdfUrl: string
): Promise<string | null> {
  const { actorUserId, invoice, customerEmail } = context;
  try {
    const [, notification] = await prisma.$transaction([
      prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "SENT", sentAt: new Date(), pdfUrl },
      }),
      prisma.notification.create({
        data: {
          customerId: invoice.customerId,
          recipientRole: "CUSTOMER",
          channel: "EMAIL",
          eventType: INVOICE_SENT_EVENT,
          severity: "INFO",
          status: "SENT",
          actorUserId,
          payload: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            email: customerEmail,
          },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: actorUserId,
          action: INVOICE_SENT_EVENT,
          entity: "Invoice",
          entityId: invoice.id,
          metadata: { customerId: invoice.customerId, email: customerEmail },
        },
      }),
    ]);

    await publishNotification({
      id: notification.id,
      eventType: notification.eventType,
      recipientRole: notification.recipientRole,
      recipientUserId: null,
      actorUserId: notification.actorUserId,
      customerId: notification.customerId,
      severity: notification.severity,
      createdAt: notification.createdAt.toISOString(),
    });
    return null;
  } catch (error) {
    console.error("Invoice post-send bookkeeping failed:", { invoiceId: invoice.id }, error);
    return POST_SEND_FAILED_WARNING;
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: invoiceId } = await context.params;
  if (!invoiceId) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const options = await parseSendOptions(request);
  if (!options) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const customer = invoice.customer;
  const customerEmail = customer.email;
  if (!customerEmail) {
    return NextResponse.json({ error: "Customer email missing" }, { status: 400 });
  }

  if (invoice.status === "SENT" && !options.force) {
    return NextResponse.json({ error: ALREADY_SENT_ERROR }, { status: 409 });
  }

  const invoiceLocale = resolveInvoiceTemplateLocale(customer.idiomaPreferencia);
  const customerName = formatCustomerName(customer);
  const sendContext: SendContext = {
    actorUserId: session.sub,
    invoice,
    customer,
    customerEmail,
  };
  const recipient = {
    to: customerEmail,
    recipientName: customerName,
    recipientRole: "CUSTOMER",
    template: "INVOICE_SENT",
    customerId: invoice.customerId,
    metadata: {
      category: INVOICE_SENT_EVENT,
      invoiceId: invoice.id,
      force: options.force,
    },
  } as const;

  if (!getMailConfig()) {
    // No PDF is generated when SMTP is missing; the transport still records the attempt.
    await sendMailAndLog({
      ...recipient,
      subject: buildUnsentSubject(invoice.number, invoiceLocale),
      text: "SMTP not configured",
    });
    return NextResponse.json({ error: "SMTP not configured" }, { status: 500 });
  }

  const lineItems = normalizeInvoiceLineItems(invoice.lineItems);
  if (lineItems.length === 0) {
    return NextResponse.json({ error: "Invoice line items missing" }, { status: 400 });
  }

  const appUrl = getPublicAppUrl();
  const invoiceTotalLabel = new Intl.NumberFormat(invoiceLocale === "ES" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(invoice.total));
  const paymentToken = await issueInvoicePaymentToken(invoice.id);

  const templates = await getEmailTemplatesConfig(invoiceLocale);
  const rendered = renderEmailTemplate(templates.INVOICE_SENT, {
    customer_name: customerName,
    customer_name_html: escapeHtml(customerName),
    invoice_number: invoice.number,
    invoice_total: invoiceTotalLabel,
    pay_link: `${appUrl}/api/pay/invoice/${paymentToken}`,
    portal_link: `${appUrl}/client/invoices`,
  });

  const pdf = await regenerateInvoicePdf({
    invoice,
    customer,
    customerName,
    lineItems,
    locale: invoiceLocale,
  });
  if (!pdf.ok) {
    return respondSendFailure(sendContext, pdf.error);
  }

  const sent = await sendMailAndLog({
    ...recipient,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    attachments: [{ filename: `${invoice.number}.pdf`, content: pdf.buffer }],
  });
  if (!sent.ok) {
    return respondSendFailure(sendContext, sent.error);
  }

  const warning = await finalizeSentInvoice(sendContext, pdf.url);
  return NextResponse.json(warning ? { ok: true, warning } : { ok: true });
}
