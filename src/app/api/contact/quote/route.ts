import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { escapeHtml, renderEmailTemplate } from "@/lib/email-templates";
import { getEmailTemplatesConfig } from "@/lib/site-settings";

export const runtime = "nodejs";

const quoteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
  service: z.string().trim().min(2).max(120),
  frequency: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = quoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const to = process.env.CONTACT_INBOX_EMAIL || user;

  if (!host || !user || !pass || !from || !to) {
    return NextResponse.json({ error: "SMTP not configured" }, { status: 500 });
  }

  const { name, email, phone, city, service, frequency, notes, source } = parsed.data;
  const safePhone = phone || "-";
  const safeCity = city || "-";
  const safeSource = source || "landing";
  const safeNotes = notes || "-";
  const safeNotesHtml = escapeHtml(safeNotes).replaceAll("\n", "<br/>");

  const templates = await getEmailTemplatesConfig();
  const rendered = renderEmailTemplate(templates.QUOTE_REQUEST, {
    name,
    name_html: escapeHtml(name),
    email,
    email_html: escapeHtml(email),
    phone: safePhone,
    phone_html: escapeHtml(safePhone),
    city: safeCity,
    city_html: escapeHtml(safeCity),
    service,
    service_html: escapeHtml(service),
    frequency,
    frequency_html: escapeHtml(frequency),
    source: safeSource,
    source_html: escapeHtml(safeSource),
    notes: safeNotes,
    notes_html: safeNotesHtml,
  });

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to,
      replyTo: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    await prisma.emailLog.create({
      data: {
        recipientEmail: to,
        recipientName: "Quote inbox",
        recipientRole: "ADMIN",
        subject: rendered.subject,
        bodyText: rendered.text,
        bodyHtml: rendered.html,
        status: "SENT",
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown send error";

    await prisma.emailLog.create({
      data: {
        recipientEmail: to,
        recipientName: "Quote inbox",
        recipientRole: "ADMIN",
        subject: rendered.subject,
        bodyText: rendered.text,
        bodyHtml: rendered.html,
        status: "FAILED",
        errorMessage: message,
      },
    });

    console.error("Quote email send failed:", error);
    return NextResponse.json({ error: "Could not send email" }, { status: 500 });
  }
}
