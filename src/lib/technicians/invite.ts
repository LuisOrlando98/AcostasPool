import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  escapeHtml,
  renderEmailTemplate,
  resolveEmailTemplateLocale,
} from "@/lib/email-templates";
import { getEmailTemplatesConfig } from "@/lib/site-settings";
import { normalizeEmail } from "@/lib/auth/email";
import { hashPasswordResetToken } from "@/lib/auth/reset-token";
import { getPublicAppUrl } from "@/lib/app-url";
import { sendMailAndLog } from "@/lib/mail/transport";

const DEFAULT_INVITE_HOURS = 48;

type InviteResult = { ok: true } | { ok: false; error: string };

export async function sendTechnicianInvite(technicianId: string): Promise<InviteResult> {
  const technician = await prisma.technician.findUnique({
    where: { id: technicianId },
    include: { user: true },
  });

  if (!technician || !technician.user) {
    return { ok: false, error: "Tecnico no encontrado" };
  }

  if (technician.user.role !== "TECH") {
    return { ok: false, error: "Usuario asociado no es tecnico" };
  }

  const normalizedEmail = normalizeEmail(technician.user.email ?? "");
  if (!normalizedEmail) {
    return { ok: false, error: "Tecnico sin email valido" };
  }

  if (technician.user.email !== normalizedEmail) {
    await prisma.user.update({
      where: { id: technician.userId },
      data: { email: normalizedEmail },
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * DEFAULT_INVITE_HOURS);

  await prisma.passwordResetToken.updateMany({
    where: {
      userId: technician.userId,
      purpose: "INVITE",
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: technician.userId,
      token: tokenHash,
      purpose: "INVITE",
      expiresAt,
    },
  });

  const inviteLink = `${getPublicAppUrl()}/complete-profile?token=${token}`;

  const techName = technician.user.fullName?.trim() || normalizedEmail;
  const templates = await getEmailTemplatesConfig(
    resolveEmailTemplateLocale(technician.user.locale)
  );
  const rendered = renderEmailTemplate(templates.TECH_ACCOUNT_INVITE, {
    tech_name: techName,
    tech_name_html: escapeHtml(techName),
    invite_link: inviteLink,
    invite_hours: String(DEFAULT_INVITE_HOURS),
  });

  // SMTP problems come back as a result (never thrown); the transport writes the EmailLog row.
  const sent = await sendMailAndLog({
    to: normalizedEmail,
    recipientName: techName,
    recipientRole: "TECH",
    template: "TECH_ACCOUNT_INVITE",
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    technicianId: technician.id,
    metadata: {
      category: "TECH_INVITE",
      technicianId: technician.id,
      userId: technician.userId,
    },
  });

  if (!sent.ok) {
    return {
      ok: false,
      error:
        sent.reason === "not_configured"
          ? "SMTP no configurado"
          : "No se pudo enviar la invitacion",
    };
  }

  return { ok: true };
}
