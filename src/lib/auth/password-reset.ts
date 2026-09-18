import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  escapeHtml,
  renderEmailTemplate,
  resolveEmailTemplateLocale,
} from "@/lib/email-templates";
import { getEmailTemplatesConfig } from "@/lib/site-settings";
import { hashPasswordResetToken } from "@/lib/auth/reset-token";
import { getMailConfig, sendMailAndLog } from "@/lib/mail/transport";

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
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * PASSWORD_RESET_HOURS);

  // Invalidating previous tokens and issuing the new one is one atomic step.
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId, purpose: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId, token: tokenHash, purpose: "PASSWORD_RESET", expiresAt },
    }),
  ]);

  return { token, expiresAt };
}

export async function sendPasswordResetEmail({
  userId,
  recipientEmail,
  recipientName,
  baseUrl,
  locale,
}: SendPasswordResetEmailInput): Promise<SendPasswordResetEmailResult> {
  const mailBase = {
    to: recipientEmail,
    recipientName,
    recipientRole: "USER",
    template: "PASSWORD_RESET",
    metadata: { category: "PASSWORD_RESET", userId },
  } as const;

  if (!getMailConfig()) {
    // No reset token is issued when SMTP is missing; the transport still records the attempt.
    await sendMailAndLog({
      ...mailBase,
      subject: "Password reset (not sent)",
      text: "SMTP not configured",
    });
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

  const sent = await sendMailAndLog({
    ...mailBase,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });

  if (!sent.ok) {
    return {
      ok: false,
      error:
        sent.reason === "not_configured"
          ? "SMTP not configured"
          : "Could not send reset email",
    };
  }

  return { ok: true };
}
