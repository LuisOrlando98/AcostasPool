import crypto from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { formatCustomerName } from "@/lib/customers/format";

const DEFAULT_INVITE_HOURS = 48;

type InviteResult = { ok: true } | { ok: false; error: string };

export async function sendCustomerInvite(customerId: string): Promise<InviteResult> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { user: true },
  });

  if (!customer) {
    return { ok: false, error: "Cliente no encontrado" };
  }

  if (!customer.email) {
    return { ok: false, error: "Cliente sin email" };
  }

  let user = customer.user ?? null;

  if (user && user.role !== "CUSTOMER") {
    return { ok: false, error: "Usuario asociado no es cliente" };
  }

  if (!user) {
    const existing = await prisma.user.findUnique({
      where: { email: customer.email },
      include: { customer: true },
    });

    if (existing) {
      if (existing.role !== "CUSTOMER") {
        return { ok: false, error: "Email en uso por otro rol" };
      }
      if (existing.customer && existing.customer.id !== customer.id) {
        return { ok: false, error: "Email ya asignado a otro cliente" };
      }
      user = existing;
      if (!customer.userId) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { userId: user.id },
        });
      }
    } else {
      const tempPassword = crypto.randomBytes(24).toString("hex");
      const passwordHash = await hashPassword(tempPassword);
      const fullName = formatCustomerName(customer);
      user = await prisma.user.create({
        data: {
          email: customer.email,
          passwordHash,
          fullName,
          role: "CUSTOMER",
          locale: customer.idiomaPreferencia,
          isActive: false,
        },
      });
      await prisma.customer.update({
        where: { id: customer.id },
        data: { userId: user.id },
      });
    }
  }

  if (user) {
    const fullName = formatCustomerName(customer);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        fullName,
        locale: customer.idiomaPreferencia,
        isActive: customer.estadoCuenta === "ACTIVE",
      },
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * DEFAULT_INVITE_HOURS
  );

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const inviteLink = `${baseUrl}/complete-profile?token=${token}`;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const smtpUser = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || smtpUser;

  if (!host || !smtpUser || !pass || !from) {
    return { ok: false, error: "SMTP no configurado" };
  }

  const customerName = formatCustomerName(customer);
  const subject = "Completa tu perfil en AcostasPool";
  const text = `Hola ${customerName},\n\nTe invitamos a completar tu perfil y crear tu contrasena para acceder al portal de clientes.\n\nIngresa aqui: ${inviteLink}\n\nEste enlace expira en ${DEFAULT_INVITE_HOURS} horas.`;
  const html = `
    <p>Hola ${customerName},</p>
    <p>Te invitamos a completar tu perfil y crear tu contrasena para acceder al portal de clientes.</p>
    <p><a href="${inviteLink}">Completar perfil</a></p>
    <p>Este enlace expira en ${DEFAULT_INVITE_HOURS} horas.</p>
  `;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user: smtpUser, pass },
  });

  await transporter.sendMail({
    from,
    to: customer.email,
    subject,
    text,
    html,
  });

  return { ok: true };
}
