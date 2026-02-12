import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { formatCustomerName } from "@/lib/customers/format";
import { createNotification } from "@/lib/notifications/create";
import { readStoredAsset } from "@/lib/storage/object-store";

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

  if (!invoice || !invoice.pdfUrl) {
    return NextResponse.json({ error: "Invoice not ready" }, { status: 400 });
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return NextResponse.json(
      { error: "SMTP not configured" },
      { status: 500 }
    );
  }

  const customerName = formatCustomerName(invoice.customer);

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });

    const pdfBuffer = await readStoredAsset(invoice.pdfUrl);

    await transporter.sendMail({
      from,
      to: invoice.customer.email,
      subject: `Invoice ${invoice.number}`,
      text: `Hola ${customerName}, adjunto tu invoice ${invoice.number}.`,
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
      },
    });

    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
