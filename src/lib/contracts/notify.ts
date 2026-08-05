import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";
import {
  escapeHtml,
  renderEmailTemplate,
  resolveEmailTemplateLocale,
} from "@/lib/email-templates";
import { getEmailTemplatesConfig } from "@/lib/site-settings";
import { getPublicAppUrl } from "@/lib/app-url";

type NotifyResult = { ok: true } | { ok: false; error: string };

export async function sendContractReadyEmail(customerId: string): Promise<NotifyResult> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return { ok: false, error: "Cliente no encontrado" };
  }
  if (!customer.email) {
    return { ok: false, error: "Cliente sin email" };
  }

  const contractLink = `${getPublicAppUrl()}/client/contract`;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const smtpUser = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || smtpUser;

  if (!host || !smtpUser || !pass || !from) {
    return { ok: false, error: "SMTP no configurado" };
  }

  const customerName = formatCustomerName(customer);
  const templates = await getEmailTemplatesConfig(
    resolveEmailTemplateLocale(customer.idiomaPreferencia)
  );
  const rendered = renderEmailTemplate(templates.CONTRACT_READY_TO_SIGN, {
    customer_name: customerName,
    customer_name_html: escapeHtml(customerName),
    contract_link: contractLink,
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
