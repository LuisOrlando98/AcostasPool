import { NextResponse } from "next/server";
import { z } from "zod";
import { escapeHtml, renderEmailTemplate } from "@/lib/email-templates";
import { getMailConfig, sendMailAndLog } from "@/lib/mail/transport";
import { getEmailTemplatesConfig } from "@/lib/site-settings";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { normalizeEmail } from "@/lib/auth/email";

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
  const ip = getClientIp(request);
  const ipRate = await checkRateLimit({
    key: `contact:quote:ip:${ip}`,
    limit: 15,
    windowMs: 60 * 60_000,
  });
  if (!ipRate.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipRate.retryAfterSeconds) },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = quoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);
  const accountRate = await checkRateLimit({
    key: `contact:quote:email:${normalizedEmail}`,
    limit: 6,
    windowMs: 60 * 60_000,
  });
  if (!accountRate.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(accountRate.retryAfterSeconds) },
      }
    );
  }

  const mailConfig = getMailConfig();
  const inboxEmail = process.env.CONTACT_INBOX_EMAIL || mailConfig?.user;

  if (!mailConfig || !inboxEmail) {
    return NextResponse.json({ error: "SMTP not configured" }, { status: 500 });
  }

  const { name, phone, city, service, frequency, notes, source } = parsed.data;
  const email = normalizedEmail;
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

  const sent = await sendMailAndLog({
    to: inboxEmail,
    recipientName: "Quote inbox",
    recipientRole: "ADMIN",
    template: "QUOTE_REQUEST",
    replyTo: email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });

  if (!sent.ok) {
    return NextResponse.json({ error: "Could not send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
