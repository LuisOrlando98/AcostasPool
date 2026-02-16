import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "@/lib/db";

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
  const subject = `New quote request - ${city || "South Florida"} - ${name}`;

  const text = [
    "New quote request received",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || "-"}`,
    `City: ${city || "-"}`,
    `Service: ${service}`,
    `Frequency: ${frequency}`,
    `Source: ${source || "landing"}`,
    "",
    "Notes:",
    notes || "-",
  ].join("\n");

  const html = `
    <h2>New quote request received</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone || "-")}</p>
    <p><strong>City:</strong> ${escapeHtml(city || "-")}</p>
    <p><strong>Service:</strong> ${escapeHtml(service)}</p>
    <p><strong>Frequency:</strong> ${escapeHtml(frequency)}</p>
    <p><strong>Source:</strong> ${escapeHtml(source || "landing")}</p>
    <p><strong>Notes:</strong><br/>${escapeHtml(notes || "-").replaceAll("\n", "<br/>")}</p>
  `;

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
      subject,
      text,
      html,
    });

    await prisma.emailLog.create({
      data: {
        recipientEmail: to,
        recipientName: "Quote inbox",
        recipientRole: "ADMIN",
        subject,
        bodyText: text,
        bodyHtml: html,
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
        subject,
        bodyText: text,
        bodyHtml: html,
        status: "FAILED",
        errorMessage: message,
      },
    });

    console.error("Quote email send failed:", error);
    return NextResponse.json({ error: "Could not send email" }, { status: 500 });
  }
}
