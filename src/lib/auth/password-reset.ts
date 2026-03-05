import crypto from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import {
  escapeHtml,
  renderEmailTemplate,
  resolveEmailTemplateLocale,
} from "@/lib/email-templates";
import { getEmailTemplatesConfig } from "@/lib/site-settings";

const PASSWORD_RESET_HOURS = 2;

type SendPasswordResetEmailInput = {
  userId: string;
  recipientEmail: string;
  recipientName: string;
  baseUrl: string;
  locale?: string | null;
};

type SendPasswordResetEmailResult = { ok: true } | { ok: false; error: string };

async function issuePasswordResetToken(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * PASSWORD_RESET_HOURS);

  await prisma.passwordResetToken.updateMany({
    where: { userId, purpose: "PASSWORD_RESET", usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: { userId, token, purpose: "PASSWORD_RESET", expiresAt },
  });

  return { token, expiresAt };
}

export async function sendPasswordResetEmail({
  userId,
  recipientEmail,
  recipientName,
  baseUrl,
  locale,
}: SendPasswordResetEmailInput): Promise<SendPasswordResetEmailResult> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    await prisma.emailLog
      .create({
        data: {
          recipientEmail,
          recipientName,
          recipientRole: "USER",
          subject: "Password reset (not sent)",
          bodyText: "SMTP not configured",
          status: "FAILED",
          errorMessage: "SMTP not configured",
          metadata: {
            category: "PASSWORD_RESET",
            userId,
          },
        },
      })
      .catch(() => null);
    return { ok: false, error: "SMTP not configured" };
  }

  const { token } = await issuePasswordResetToken(userId);
  const resetLink = `${baseUrl.replace(/\/+$/, "")}/reset?token=${token}`;

  const templates = await getEmailTemplatesConfig(
    resolveEmailTemplateLocale(locale)
  );
  const rendered = renderEmailTemplate(templates.PASSWORD_RESET, {
    recipient_name: recipientName,
    recipient_name_html: escapeHtml(recipientName),
    reset_link: resetLink,
    reset_hours: String(PASSWORD_RESET_HOURS),
  });

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from,
      to: recipientEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    await prisma.emailLog.create({
      data: {
        recipientEmail,
        recipientName,
        recipientRole: "USER",
        subject: rendered.subject,
        bodyText: rendered.text,
        bodyHtml: rendered.html,
        status: "SENT",
        sentAt: new Date(),
        metadata: {
          category: "PASSWORD_RESET",
          userId,
        },
      },
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown send error";
    await prisma.emailLog.create({
      data: {
        recipientEmail,
        recipientName,
        recipientRole: "USER",
        subject: rendered.subject,
        bodyText: rendered.text,
        bodyHtml: rendered.html,
        status: "FAILED",
        errorMessage: message,
        metadata: {
          category: "PASSWORD_RESET",
          userId,
        },
      },
    });
    console.error("Password reset email failed:", error);
    return { ok: false, error: "Could not send reset email" };
  }
}
