import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";
import { escapeHtml, renderEmailTemplate, resolveEmailTemplateLocale } from "@/lib/email-templates";
import { getEmailTemplatesConfig } from "@/lib/site-settings";
import { computeMembershipFeeCents } from "@/lib/payments/fees";

type NotifyResult = { ok: true } | { ok: false; error: string };

export async function sendMembershipStartEmail(
  customerId: string,
  propertyId: string
): Promise<NotifyResult> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return { ok: false, error: "Cliente no encontrado" };
  }
  if (!customer.email) {
    return { ok: false, error: "Cliente sin email" };
  }

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property || property.customerId !== customerId || property.servicePrice === null) {
    return { ok: false, error: "Propiedad invalida o sin precio de servicio" };
  }

  const baseUrl = process.env.APP_URL?.trim();
  if (!baseUrl) {
    return { ok: false, error: "APP_URL no configurado" };
  }
  const activationLink = `${baseUrl}/client/membership/activate?propertyId=${propertyId}`;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const smtpUser = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || smtpUser;
  if (!host || !smtpUser || !pass || !from) {
    return { ok: false, error: "SMTP no configurado" };
  }

  const { totalCents } = computeMembershipFeeCents(Math.round(Number(property.servicePrice) * 100));
  const monthlyAmount = new Intl.NumberFormat(
    customer.idiomaPreferencia === "ES" ? "es-US" : "en-US",
    { style: "currency", currency: "USD" }
  ).format(totalCents / 100);

  const customerName = formatCustomerName(customer);
  const propertyAddress = property.name?.trim() || property.address;
  const templates = await getEmailTemplatesConfig(resolveEmailTemplateLocale(customer.idiomaPreferencia));
  const rendered = renderEmailTemplate(templates.MEMBERSHIP_START_INVITE, {
    customer_name: customerName,
    customer_name_html: escapeHtml(customerName),
    activation_link: activationLink,
    property_address: propertyAddress,
    property_address_html: escapeHtml(propertyAddress),
    monthly_amount: monthlyAmount,
  });

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: smtpUser, pass },
  });

  await transporter.sendMail({
    from,
    to: customer.email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });

  return { ok: true };
}
