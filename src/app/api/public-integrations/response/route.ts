import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/email";
import { escapeHtml } from "@/lib/email-templates";
import { isAllowedPublicIntegrationToken } from "@/lib/public-integrations";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
const DEV_NOTIFICATION_EMAIL = "dev@wyxloop.com";

const dataUrlPattern = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

const responseSchema = z.object({
  token: z.string().trim().min(12).max(120),
  clientName: z.string().trim().min(2).max(120),
  clientEmail: z.string().trim().email().max(180),
  companyName: z.string().trim().max(120).optional(),
  decision: z.enum(["ACCEPT", "DECLINE"]),
  acceptTerms: z.boolean().optional().default(false),
  comments: z.string().trim().max(1200).optional(),
  signatureDataUrl: z
    .string()
    .trim()
    .min(120)
    .max(900_000)
    .regex(dataUrlPattern, "Invalid signature format"),
});

function getAppLoginUrl() {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    return "https://acostaspool.com/login";
  }
  const normalizedAppUrl = appUrl.startsWith("http://") || appUrl.startsWith("https://")
    ? appUrl
    : `https://${appUrl}`;
  return `${normalizedAppUrl.replace(/\/+$/, "")}/login`;
}

function getDecisionLabel(decision: "ACCEPT" | "DECLINE") {
  if (decision === "ACCEPT") {
    return {
      shortEs: "Aprobado",
      shortEn: "Approved",
      detailEs: "Acepta proceder con la integracion Stripe propuesta.",
      detailEn: "Approved to proceed with the proposed Stripe integration.",
    };
  }
  return {
    shortEs: "No aprobado por ahora",
    shortEn: "Not approved at this time",
    detailEs: "No acepta proceder por ahora con la integracion Stripe.",
    detailEn: "Did not approve proceeding with the Stripe integration at this time.",
  };
}

function buildClientEmailPayload(input: {
  clientName: string;
  clientEmail: string;
  companyName?: string | null;
  decision: "ACCEPT" | "DECLINE";
  comments?: string | null;
  responseId: string;
  token: string;
  updatedAtIso: string;
}) {
  const labels = getDecisionLabel(input.decision);
  const loginUrl = getAppLoginUrl();
  const company = input.companyName?.trim() || "-";
  const comments = input.comments?.trim() || "-";

  const subject =
    input.decision === "ACCEPT"
      ? "AcostasPool - Confirmacion recibida: propuesta aprobada"
      : "AcostasPool - Confirmacion recibida: propuesta no aprobada por ahora";

  const text = [
    `Hola ${input.clientName},`,
    "",
    "Recibimos tu confirmacion sobre la mejora de integracion Stripe.",
    `Estado: ${labels.shortEs} / ${labels.shortEn}`,
    `Detalle: ${labels.detailEs}`,
    "",
    `Nombre: ${input.clientName}`,
    `Email: ${input.clientEmail}`,
    `Empresa: ${company}`,
    `Referencia: ${input.responseId}`,
    `Token del documento: ${input.token}`,
    `Fecha de registro: ${input.updatedAtIso}`,
    `Comentario: ${comments}`,
    "",
    "Gracias.",
    `Puedes iniciar sesion aqui: ${loginUrl}`,
  ].join("\n");

  const safeName = escapeHtml(input.clientName);
  const safeEmail = escapeHtml(input.clientEmail);
  const safeCompany = escapeHtml(company);
  const safeComments = escapeHtml(comments).replaceAll("\n", "<br/>");
  const safeDecisionEs = escapeHtml(labels.shortEs);
  const safeDecisionEn = escapeHtml(labels.shortEn);
  const safeDetailEs = escapeHtml(labels.detailEs);
  const safeResponseId = escapeHtml(input.responseId);
  const safeToken = escapeHtml(input.token);
  const safeUpdatedAt = escapeHtml(input.updatedAtIso);
  const safeLoginUrl = escapeHtml(loginUrl);

  const html = [
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
    `<h2 style="margin:0 0 12px;color:#0f172a;">Confirmacion recibida</h2>`,
    `<p style="margin:0 0 12px;color:#334155;">Hola ${safeName}, recibimos tu respuesta sobre la integracion Stripe.</p>`,
    '<div style="margin:0 0 14px;padding:12px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;">',
    `<p style="margin:0 0 6px;color:#0f172a;"><strong>Estado:</strong> ${safeDecisionEs} / ${safeDecisionEn}</p>`,
    `<p style="margin:0;color:#334155;">${safeDetailEs}</p>`,
    "</div>",
    '<p style="margin:0 0 6px;color:#334155;"><strong>Nombre:</strong> ' + safeName + "</p>",
    '<p style="margin:0 0 6px;color:#334155;"><strong>Email:</strong> ' + safeEmail + "</p>",
    '<p style="margin:0 0 6px;color:#334155;"><strong>Empresa:</strong> ' + safeCompany + "</p>",
    '<p style="margin:0 0 6px;color:#334155;"><strong>Referencia:</strong> ' + safeResponseId + "</p>",
    '<p style="margin:0 0 6px;color:#334155;"><strong>Token del documento:</strong> ' + safeToken + "</p>",
    '<p style="margin:0 0 6px;color:#334155;"><strong>Fecha de registro:</strong> ' + safeUpdatedAt + "</p>",
    '<p style="margin:0 0 12px;color:#334155;"><strong>Comentario:</strong><br/>' + safeComments + "</p>",
    `<p style="margin:0;"><a href="${safeLoginUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">Ir al login de AcostasPool</a></p>`,
    "</div>",
  ].join("");

  return { subject, text, html, loginUrl };
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipRate = await checkRateLimit({
    key: `public-integration:response:ip:${ip}`,
    limit: 20,
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
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const payload = parsed.data;
  if (!isAllowedPublicIntegrationToken(payload.token)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const clientEmail = normalizeEmail(payload.clientEmail);
  const emailRate = await checkRateLimit({
    key: `public-integration:response:email:${clientEmail}`,
    limit: 8,
    windowMs: 60 * 60_000,
  });
  if (!emailRate.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(emailRate.retryAfterSeconds) },
      }
    );
  }

  if (payload.decision === "ACCEPT" && !payload.acceptTerms) {
    return NextResponse.json(
      { error: "Terms must be accepted to approve this integration." },
      { status: 400 }
    );
  }

  const record = await prisma.publicIntegrationResponse.upsert({
    where: {
      token_clientEmail: {
        token: payload.token,
        clientEmail,
      },
    },
    update: {
      clientName: payload.clientName,
      companyName: payload.companyName?.trim() || null,
      decision: payload.decision,
      acceptTerms: payload.acceptTerms,
      comments: payload.comments?.trim() || null,
      signatureDataUrl: payload.signatureDataUrl,
      ipAddress: ip || null,
      userAgent: request.headers.get("user-agent") || null,
    },
    create: {
      token: payload.token,
      clientName: payload.clientName,
      clientEmail,
      companyName: payload.companyName?.trim() || null,
      decision: payload.decision,
      acceptTerms: payload.acceptTerms,
      comments: payload.comments?.trim() || null,
      signatureDataUrl: payload.signatureDataUrl,
      ipAddress: ip || null,
      userAgent: request.headers.get("user-agent") || null,
    },
    select: {
      id: true,
      decision: true,
      updatedAt: true,
    },
  });

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;
  const internalInbox = process.env.CONTACT_INBOX_EMAIL || smtpUser;

  if (!host || !smtpUser || !smtpPass || !smtpFrom) {
    await prisma.emailLog
      .create({
        data: {
          recipientEmail: clientEmail,
          recipientName: payload.clientName,
          recipientRole: "CUSTOMER",
          subject: "Public integration confirmation (not sent)",
          bodyText: "SMTP not configured",
          status: "FAILED",
          errorMessage: "SMTP not configured",
          metadata: {
            category: "PUBLIC_INTEGRATION_RESPONSE",
            responseId: record.id,
            decision: record.decision,
            token: payload.token,
          },
        },
      })
      .catch(() => null);

    return NextResponse.json(
      { error: "Email service is not configured. Please try again later." },
      { status: 500 }
    );
  }

  const rendered = buildClientEmailPayload({
    clientName: payload.clientName,
    clientEmail,
    companyName: payload.companyName,
    decision: payload.decision,
    comments: payload.comments,
    responseId: record.id,
    token: payload.token,
    updatedAtIso: record.updatedAt.toISOString(),
  });

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const bccRecipients = new Set<string>();
    const normalizedClientEmail = normalizeEmail(clientEmail);
    const normalizedInternalInbox = normalizeEmail(internalInbox || "");
    const normalizedDevEmail = normalizeEmail(DEV_NOTIFICATION_EMAIL);

    if (normalizedInternalInbox && normalizedInternalInbox !== normalizedClientEmail) {
      bccRecipients.add(normalizedInternalInbox);
    }
    if (normalizedDevEmail && normalizedDevEmail !== normalizedClientEmail) {
      bccRecipients.add(normalizedDevEmail);
    }

    const bccList = Array.from(bccRecipients);

    await transporter.sendMail({
      from: smtpFrom,
      to: clientEmail,
      bcc: bccList.length > 0 ? bccList.join(",") : undefined,
      replyTo: internalInbox || undefined,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    await prisma.emailLog
      .create({
        data: {
          recipientEmail: clientEmail,
          recipientName: payload.clientName,
          recipientRole: "CUSTOMER",
          subject: rendered.subject,
          bodyText: rendered.text,
          bodyHtml: rendered.html,
          status: "SENT",
          sentAt: new Date(),
          metadata: {
            category: "PUBLIC_INTEGRATION_RESPONSE",
            responseId: record.id,
            decision: record.decision,
            token: payload.token,
          },
        },
      })
      .catch(() => null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown send error";
    await prisma.emailLog
      .create({
        data: {
          recipientEmail: clientEmail,
          recipientName: payload.clientName,
          recipientRole: "CUSTOMER",
          subject: rendered.subject,
          bodyText: rendered.text,
          bodyHtml: rendered.html,
          status: "FAILED",
          errorMessage: message,
          metadata: {
            category: "PUBLIC_INTEGRATION_RESPONSE",
            responseId: record.id,
            decision: record.decision,
            token: payload.token,
          },
        },
      })
      .catch(() => null);

    console.error("Public integration response email failed:", error);
    return NextResponse.json(
      { error: "Could not send confirmation email. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: record.id,
    decision: record.decision,
    updatedAt: record.updatedAt.toISOString(),
    loginUrl: rendered.loginUrl,
  });
}
