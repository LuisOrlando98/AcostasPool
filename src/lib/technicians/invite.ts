import crypto from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import {
  escapeHtml,
  renderEmailTemplate,
  resolveEmailTemplateLocale,
} from "@/lib/email-templates";
import { getEmailTemplatesConfig } from "@/lib/site-settings";
import { normalizeEmail } from "@/lib/auth/email";
import { hashPasswordResetToken } from "@/lib/auth/reset-token";

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

  const baseUrl = process.env.APP_URL?.trim();
  if (!baseUrl) {
    return { ok: false, error: "APP_URL no configurado" };
  }
  const inviteLink = `${baseUrl.replace(/\/+$/, "")}/complete-profile?token=${token}`;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const smtpUser = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || smtpUser;
  const techName = technician.user.fullName?.trim() || normalizedEmail;

  const metadata = {
    category: "TECH_INVITE",
    technicianId: technician.id,
    userId: technician.userId,
  };

  if (!host || !smtpUser || !pass || !from) {
    await prisma.emailLog.create({
      data: {
        recipientEmail: normalizedEmail,
        recipientName: techName,
        recipientRole: "TECH",
        subject: "Technician invite (not sent)",
        bodyText: "SMTP not configured",
        status: "FAILED",
        errorMessage: "SMTP not configured",
        technicianId: technician.id,
        metadata,
      },
    });
    return { ok: false, error: "SMTP no configurado" };
  }

  const templates = await getEmailTemplatesConfig(
    resolveEmailTemplateLocale(technician.user.locale)
  );
  const rendered = renderEmailTemplate(templates.TECH_ACCOUNT_INVITE, {
    tech_name: techName,
    tech_name_html: escapeHtml(techName),
    invite_link: inviteLink,
    invite_hours: String(DEFAULT_INVITE_HOURS),
  });

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: smtpUser, pass },
  });

  try {
    await transporter.sendMail({
      from,
      to: normalizedEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    await prisma.emailLog.create({
      data: {
        recipientEmail: normalizedEmail,
        recipientName: techName,
        recipientRole: "TECH",
        subject: rendered.subject,
        bodyText: rendered.text,
        bodyHtml: rendered.html,
        status: "SENT",
        sentAt: new Date(),
        technicianId: technician.id,
        metadata,
      },
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown send error";
    await prisma.emailLog.create({
      data: {
        recipientEmail: normalizedEmail,
        recipientName: techName,
        recipientRole: "TECH",
        subject: rendered.subject,
        bodyText: rendered.text,
        bodyHtml: rendered.html,
        status: "FAILED",
        errorMessage: message,
        technicianId: technician.id,
        metadata,
      },
    });
    console.error("Technician invite failed:", error);
    return { ok: false, error: "No se pudo enviar la invitacion" };
  }
}
