const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { DateTime } = require("luxon");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TZ = "America/New_York";
const CUSTOMER_EVENTS = ["SERVICE_SCHEDULED", "SERVICE_RESCHEDULED", "JOB_COMPLETED"];
const TEMPLATE_TOKEN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
const TEMPLATE_CACHE_MS = 60 * 1000;
const SPANISH_HINT_PATTERN =
  /\b(hola|servicio|factura|correo|gracias|direccion|reprogramado|completado|contrasena|solicitud)\b/i;

const EMAIL_TEMPLATE_DEFAULTS = {
  CUSTOMER_SERVICE_SCHEDULED: {
    subject: "Servicio programado - {{scheduled_label}}",
    text: [
      "Hola {{customer_name}},",
      "",
      "Tu servicio esta programado para {{scheduled_label}}.",
      "Si necesitas cambiar la fecha, por favor contactanos.",
      "",
      "Direccion: {{job_address}}",
    ].join("\n"),
    html: [
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
      '<h3 style="margin:0 0 10px;color:#0b1f35;">Servicio programado</h3>',
      '<p style="margin:0 0 10px;color:#334155;">Hola {{customer_name_html}}, tu servicio esta programado para <strong>{{scheduled_label_html}}</strong>.</p>',
      '<p style="margin:0;color:#64748b;">Direccion: {{job_address_html}}</p>',
      "</div>",
    ].join(""),
  },
  CUSTOMER_SERVICE_RESCHEDULED: {
    subject: "Servicio reprogramado - {{scheduled_label}}",
    text: [
      "Hola {{customer_name}},",
      "",
      "Tu servicio ha sido reprogramado para {{scheduled_label}}.",
      "Lamentamos el inconveniente y agradecemos tu comprension.",
      "Si tienes dudas, por favor responde a este correo.",
      "",
      "Direccion: {{job_address}}",
    ].join("\n"),
    html: [
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
      '<h3 style="margin:0 0 10px;color:#0b1f35;">Servicio reprogramado</h3>',
      '<p style="margin:0 0 10px;color:#334155;">Hola {{customer_name_html}}, tu servicio ha sido reprogramado para <strong>{{scheduled_label_html}}</strong>.</p>',
      '<p style="margin:0;color:#64748b;">Direccion: {{job_address_html}}</p>',
      "</div>",
    ].join(""),
  },
  CUSTOMER_JOB_COMPLETED: {
    subject: "Servicio completado - {{completed_label}}",
    text: [
      "Hola {{customer_name}},",
      "",
      "Tu servicio fue completado por {{technician_name}}.",
      "Hora de finalizacion: {{completed_label}}.",
      "",
      "Direccion: {{job_address}}",
      "Puedes revisar las evidencias en tu portal de cliente.",
    ].join("\n"),
    html: [
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
      '<h3 style="margin:0 0 10px;color:#0b1f35;">Servicio completado</h3>',
      '<p style="margin:0 0 10px;color:#334155;">Hola {{customer_name_html}}, tu servicio fue completado por <strong>{{technician_name_html}}</strong>.</p>',
      '<p style="margin:0 0 10px;color:#334155;">Hora de finalizacion: <strong>{{completed_label_html}}</strong>.</p>',
      '<p style="margin:0;color:#64748b;">Direccion: {{job_address_html}}</p>',
      "</div>",
    ].join(""),
  },
  TECH_DAILY_DIGEST: {
    subject: "Ruta - {{tech_name}} - {{route_date}}",
    text: [
      "Hola {{tech_name}},",
      "",
      "Esta es tu ruta para hoy ({{route_date}}):",
      "{{lines_text}}",
      "",
      "Recibiras actualizaciones a las 12:00pm y 9:00pm si hay cambios.",
    ].join("\n"),
    html: [
      '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
      '<h3 style="margin:0 0 10px;color:#0b1f35;">Ruta diaria</h3>',
      '<p style="margin:0 0 10px;color:#334155;">Hola {{tech_name_html}}, esta es tu ruta para hoy ({{route_date}}):</p>',
      '<ol style="margin:0 0 12px;padding-left:20px;color:#334155;">{{lines_html}}</ol>',
      '<p style="margin:0;color:#64748b;">Recibiras actualizaciones a las 12:00pm y 9:00pm si hay cambios.</p>',
      "</div>",
    ].join(""),
  },
  TECH_CHANGE_DIGEST: {
    subject: "Cambios de ruta - {{tech_name}} - {{route_date}}",
    text: [
      "Hola {{tech_name}},",
      "",
      "Cambios detectados en tu ruta del {{route_date}}:",
      "{{lines_text}}",
      "",
      "Si necesitas aclaraciones, contacta al administrador.",
    ].join("\n"),
    html: [
      '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
      '<h3 style="margin:0 0 10px;color:#0b1f35;">Cambios de ruta</h3>',
      '<p style="margin:0 0 10px;color:#334155;">Hola {{tech_name_html}}, estos son los cambios detectados en tu ruta del {{route_date}}:</p>',
      '<ol style="margin:0 0 12px;padding-left:20px;color:#334155;">{{lines_html}}</ol>',
      '<p style="margin:0;color:#64748b;">Si necesitas aclaraciones, contacta al administrador.</p>',
      "</div>",
    ].join(""),
  },
};

const CUSTOMER_TEMPLATE_DEFAULTS_EN = {
  CUSTOMER_SERVICE_SCHEDULED: {
    subject: "Service scheduled - {{scheduled_label}}",
    text: [
      "Hi {{customer_name}},",
      "",
      "Your service is scheduled for {{scheduled_label}}.",
      "If you need to reschedule, please contact us.",
      "",
      "Address: {{job_address}}",
    ].join("\n"),
    html: [
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
      '<h3 style="margin:0 0 10px;color:#0b1f35;">Service scheduled</h3>',
      '<p style="margin:0 0 10px;color:#334155;">Hi {{customer_name_html}}, your service is scheduled for <strong>{{scheduled_label_html}}</strong>.</p>',
      '<p style="margin:0;color:#64748b;">Address: {{job_address_html}}</p>',
      "</div>",
    ].join(""),
  },
  CUSTOMER_SERVICE_RESCHEDULED: {
    subject: "Service rescheduled - {{scheduled_label}}",
    text: [
      "Hi {{customer_name}},",
      "",
      "Your service has been rescheduled for {{scheduled_label}}.",
      "We are sorry for the inconvenience and appreciate your understanding.",
      "If you have any questions, please reply to this email.",
      "",
      "Address: {{job_address}}",
    ].join("\n"),
    html: [
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
      '<h3 style="margin:0 0 10px;color:#0b1f35;">Service rescheduled</h3>',
      '<p style="margin:0 0 10px;color:#334155;">Hi {{customer_name_html}}, your service has been rescheduled for <strong>{{scheduled_label_html}}</strong>.</p>',
      '<p style="margin:0;color:#64748b;">Address: {{job_address_html}}</p>',
      "</div>",
    ].join(""),
  },
  CUSTOMER_JOB_COMPLETED: {
    subject: "Service completed - {{completed_label}}",
    text: [
      "Hi {{customer_name}},",
      "",
      "Your service was completed by {{technician_name}}.",
      "Completion time: {{completed_label}}.",
      "",
      "Address: {{job_address}}",
      "You can review the evidence in your customer portal.",
    ].join("\n"),
    html: [
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
      '<h3 style="margin:0 0 10px;color:#0b1f35;">Service completed</h3>',
      '<p style="margin:0 0 10px;color:#334155;">Hi {{customer_name_html}}, your service was completed by <strong>{{technician_name_html}}</strong>.</p>',
      '<p style="margin:0 0 10px;color:#334155;">Completion time: <strong>{{completed_label_html}}</strong>.</p>',
      '<p style="margin:0;color:#64748b;">Address: {{job_address_html}}</p>',
      "</div>",
    ].join(""),
  },
};

const EMAIL_TEMPLATE_DEFAULTS_BY_LOCALE = Object.fromEntries(
  Object.entries(EMAIL_TEMPLATE_DEFAULTS).map(([templateId, template]) => [
    templateId,
    { EN: template, ES: template },
  ])
);

for (const [templateId, template] of Object.entries(CUSTOMER_TEMPLATE_DEFAULTS_EN)) {
  if (!EMAIL_TEMPLATE_DEFAULTS_BY_LOCALE[templateId]) {
    continue;
  }
  EMAIL_TEMPLATE_DEFAULTS_BY_LOCALE[templateId].EN = template;
}

const EMAIL_TEMPLATE_LABELS = {
  CUSTOMER_SERVICE_SCHEDULED: "Service scheduled",
  CUSTOMER_SERVICE_RESCHEDULED: "Service rescheduled",
  CUSTOMER_JOB_COMPLETED: "Job completed",
  TECH_DAILY_DIGEST: "Daily route digest",
  TECH_CHANGE_DIGEST: "Route changes digest",
};

let emailTemplateCache = EMAIL_TEMPLATE_DEFAULTS_BY_LOCALE;
let emailTemplateCacheAt = 0;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const interpolateTemplate = (content, variables) =>
  String(content ?? "").replace(TEMPLATE_TOKEN, (_match, token) => variables[token] ?? "");

const resolveEmailTemplateLocale = (locale) => {
  const normalized = String(locale ?? "")
    .trim()
    .toUpperCase();
  if (normalized.startsWith("ES")) {
    return "ES";
  }
  return "EN";
};

const guessTemplateLocale = (template) => {
  const haystack = `${template?.subject || ""}\n${template?.text || ""}\n${template?.html || ""}`;
  return SPANISH_HINT_PATTERN.test(haystack) ? "ES" : "EN";
};

const buildEmailBodyBlocks = (templateId, text) => {
  const rawLines = String(text ?? "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    blocks.push(
      `<ul style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.6;">${listItems
        .map((item) => `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`)
        .join("")}</ul>`
    );
    listItems = [];
  };

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed === "{{invite_link}}") {
      flushList();
      blocks.push(
        '<div style="margin:0 0 18px;"><a href="{{invite_link}}" style="display:inline-block;padding:11px 18px;border-radius:999px;background:linear-gradient(135deg,#0ea5e9,#22c55e);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Complete profile</a></div>'
      );
      continue;
    }

    if (trimmed === "{{lines_text}}") {
      flushList();
      if (templateId === "TECH_DAILY_DIGEST" || templateId === "TECH_CHANGE_DIGEST") {
        blocks.push(
          '<ol style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.6;">{{lines_html}}</ol>'
        );
      } else {
        blocks.push(
          '<p style="margin:0 0 12px;color:#334155;line-height:1.65;">{{lines_text}}</p>'
        );
      }
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }

    flushList();
    blocks.push(
      `<p style="margin:0 0 12px;color:#334155;line-height:1.65;">${escapeHtml(trimmed)}</p>`
    );
  }

  flushList();
  return blocks.join("");
};

const buildPremiumEmailTemplateHtml = (templateId, subject, text) => {
  const bodyBlocks = buildEmailBodyBlocks(templateId, text);
  const label = EMAIL_TEMPLATE_LABELS[templateId] || "Notification";
  const appUrlRaw = (process.env.APP_URL || "https://acostaspool.com").trim();
  const appUrlNormalized = /^https?:\/\//i.test(appUrlRaw)
    ? appUrlRaw
    : `https://${appUrlRaw}`;
  let appOrigin = "https://acostaspool.com";
  try {
    appOrigin = new URL(appUrlNormalized).origin.replace(/\/+$/, "");
  } catch {
    appOrigin = "https://acostaspool.com";
  }
  const legalCenterUrl = `${appOrigin}/legal`;
  const privacyUrl = `${appOrigin}/legal/privacy-policy`;
  const termsUrl = `${appOrigin}/legal/terms-of-service`;
  const paymentUrl = `${appOrigin}/legal/payment-cancellation-policy`;
  const disclaimerUrl = `${appOrigin}/legal/disclaimer-limitation-of-liability`;
  const cookieUrl = `${appOrigin}/legal/cookie-notice`;

  return [
    '<div style="margin:0;padding:26px;background:#edf2f7;font-family:Inter,Arial,sans-serif;">',
    '<div style="max-width:680px;margin:0 auto;border:1px solid #d7e3f0;border-radius:20px;overflow:hidden;background:#ffffff;box-shadow:0 18px 36px rgba(15,23,42,0.12);">',
    '<div style="padding:18px 22px;background:linear-gradient(140deg,#0b3b66,#0ea5e9);color:#ffffff;">',
    '<p style="margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#e8f7ff;">AcostasPool</p>',
    `<h2 style="margin:8px 0 0;font-size:19px;line-height:1.3;font-weight:800;color:#ffffff;">${escapeHtml(
      label
    )}</h2>`,
    `<p style="margin:8px 0 0;font-size:13px;line-height:1.45;color:#eaf7ff;">${escapeHtml(
      subject
    )}</p>`,
    "</div>",
    '<div style="padding:22px 22px 16px;">',
    bodyBlocks,
    '<div style="margin-top:18px;padding:12px 14px;border:1px solid #d8e5f2;border-radius:12px;background:#f8fbff;">',
    '<p style="margin:0 0 7px;color:#0f172a;font-size:12px;font-weight:700;">Need help?</p>',
    '<p style="margin:0;color:#475569;font-size:12px;line-height:1.55;">Reply to this email or contact <a href="mailto:support@acostaspool.com" style="color:#0c4a6e;text-decoration:underline;">support@acostaspool.com</a>.</p>',
    "</div>",
    "</div>",
    '<div style="padding:12px 22px;border-top:1px solid #e2e8f0;background:#f8fafc;">',
    `<p style="margin:0 0 6px;color:#475569;font-size:11px;line-height:1.5;">Legal: <a href="${legalCenterUrl}" style="color:#0c4a6e;text-decoration:underline;">Legal Center</a> | <a href="${privacyUrl}" style="color:#0c4a6e;text-decoration:underline;">Privacy Policy</a> | <a href="${termsUrl}" style="color:#0c4a6e;text-decoration:underline;">Terms of Service</a></p>`,
    `<p style="margin:0 0 7px;color:#64748b;font-size:10px;line-height:1.5;">More policies: <a href="${paymentUrl}" style="color:#0c4a6e;text-decoration:underline;">Payment and Cancellation</a> | <a href="${disclaimerUrl}" style="color:#0c4a6e;text-decoration:underline;">Disclaimer and Liability</a> | <a href="${cookieUrl}" style="color:#0c4a6e;text-decoration:underline;">Cookie Notice</a></p>`,
    '<p style="margin:0 0 4px;color:#0f172a;font-size:11px;line-height:1.45;font-weight:700;">Digitally signed by AcostasPool Operations Team</p>',
    '<p style="margin:0;color:#64748b;font-size:10px;line-height:1.45;">AcostasPool | Premium pool operations | support@acostaspool.com</p>',
    "</div>",
    "</div>",
    "</div>",
  ].join("");
};

const normalizeTemplateContent = (templateId, value, fallback) => {
  const input = value && typeof value === "object" ? value : {};
  const subject = String(input.subject ?? fallback.subject);
  const text = String(input.text ?? fallback.text);
  return {
    subject,
    text,
    html: buildPremiumEmailTemplateHtml(templateId, subject, text),
  };
};

const normalizeTemplateConfig = (value) => {
  const input = value && typeof value === "object" ? value : {};
  const normalized = {};

  for (const [templateId, fallbackByLocale] of Object.entries(EMAIL_TEMPLATE_DEFAULTS_BY_LOCALE)) {
    const rawTemplate =
      input[templateId] && typeof input[templateId] === "object" ? input[templateId] : null;
    const rawEN =
      rawTemplate?.EN && typeof rawTemplate.EN === "object" ? rawTemplate.EN : null;
    const rawES =
      rawTemplate?.ES && typeof rawTemplate.ES === "object" ? rawTemplate.ES : null;

    if (rawEN || rawES) {
      normalized[templateId] = {
        EN: normalizeTemplateContent(templateId, rawEN || rawES, fallbackByLocale.EN),
        ES: normalizeTemplateContent(templateId, rawES || rawEN, fallbackByLocale.ES),
      };
      continue;
    }

    const legacyTemplate = normalizeTemplateContent(
      templateId,
      rawTemplate || input[templateId],
      fallbackByLocale.EN
    );
    const guessedLocale = guessTemplateLocale(legacyTemplate);
    normalized[templateId] = {
      EN: guessedLocale === "EN" ? legacyTemplate : fallbackByLocale.EN,
      ES: guessedLocale === "ES" ? legacyTemplate : fallbackByLocale.ES,
    };
  }

  return normalized;
};

const getEmailTemplates = async () => {
  if (Date.now() - emailTemplateCacheAt < TEMPLATE_CACHE_MS) {
    return emailTemplateCache;
  }

  const settings = await prisma.siteSettings.findUnique({
    where: { id: "default" },
    select: { emailTemplates: true },
  });

  emailTemplateCache = normalizeTemplateConfig(settings?.emailTemplates);
  emailTemplateCacheAt = Date.now();
  return emailTemplateCache;
};

const renderTemplateById = async (templateId, variables, locale = "EN") => {
  const resolvedLocale = resolveEmailTemplateLocale(locale);
  const templates = await getEmailTemplates();
  const templateByLocale =
    templates[templateId] ?? EMAIL_TEMPLATE_DEFAULTS_BY_LOCALE[templateId];
  const template =
    templateByLocale?.[resolvedLocale] || templateByLocale?.EN || templateByLocale?.ES;

  return {
    subject: interpolateTemplate(template.subject, variables),
    text: interpolateTemplate(template.text, variables),
    html: interpolateTemplate(template.html, variables),
  };
};

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP not configured");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });

  return { transporter, from };
};

const formatDateTime = (date, locale = "EN") =>
  DateTime.fromJSDate(date, { zone: "utc" })
    .setZone(TZ)
    .setLocale(locale === "ES" ? "es" : "en")
    .toFormat(locale === "ES" ? "dd LLL yyyy hh:mm a" : "MMM dd, yyyy hh:mm a");

const getCustomerName = (customer, locale = "ES") => {
  if (!customer) {
    return locale === "EN" ? "Customer" : "Cliente";
  }

  const fullName = [customer.nombre, customer.apellidos].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  return customer.name || customer.email || (locale === "EN" ? "Customer" : "Cliente");
};

const buildCustomerEmail = async (notification, job) => {
  const customerLocale = resolveEmailTemplateLocale(job?.customer?.idiomaPreferencia);
  const payload =
    notification.payload && typeof notification.payload === "object"
      ? notification.payload
      : {};
  const completedAtFromPayload =
    typeof payload.completedAt === "string" ? new Date(payload.completedAt) : null;
  const completedAt =
    completedAtFromPayload && !Number.isNaN(completedAtFromPayload.getTime())
      ? completedAtFromPayload
      : job.completedAt || notification.createdAt;
  const scheduledLabel = formatDateTime(job.scheduledDate, customerLocale);
  const completedLabel = formatDateTime(completedAt, customerLocale);
  const customerName = getCustomerName(job.customer, customerLocale);
  const technicianNameFromPayload =
    typeof payload.technicianName === "string" ? payload.technicianName : null;
  const technicianName =
    technicianNameFromPayload ||
    job.technician?.user?.fullName ||
    "Equipo de servicio";
  const templateId =
    notification.eventType === "SERVICE_RESCHEDULED"
      ? "CUSTOMER_SERVICE_RESCHEDULED"
      : notification.eventType === "JOB_COMPLETED"
        ? "CUSTOMER_JOB_COMPLETED"
        : "CUSTOMER_SERVICE_SCHEDULED";

  return renderTemplateById(templateId, {
    customer_name: customerName,
    customer_name_html: escapeHtml(customerName),
    scheduled_label: scheduledLabel,
    scheduled_label_html: escapeHtml(scheduledLabel),
    completed_label: completedLabel,
    completed_label_html: escapeHtml(completedLabel),
    technician_name: technicianName,
    technician_name_html: escapeHtml(technicianName),
    job_address: job.property.address,
    job_address_html: escapeHtml(job.property.address),
  }, customerLocale);
};

const buildRouteLine = (job) => {
  const timeLabel = formatDateTime(job.scheduledDate);
  return `${timeLabel} - ${getCustomerName(job.customer)} - ${job.property.address}`;
};

const buildIndexedLinesText = (lines) => lines.map((line, index) => `${index + 1}. ${line}`).join("\n");

const buildIndexedLinesHtml = (lines) =>
  lines.map((line) => `<li>${escapeHtml(`${line}`)}</li>`).join("");

const buildChangeLine = (item) => {
  const job = item.job;
  const customerName = getCustomerName(job?.customer);
  const address = job?.property?.address || "Direccion pendiente";
  const payload = item.payload || {};
  const from = payload.fromScheduledDate
    ? formatDateTime(new Date(payload.fromScheduledDate))
    : null;
  const to = payload.toScheduledDate
    ? formatDateTime(new Date(payload.toScheduledDate))
    : job
      ? formatDateTime(job.scheduledDate)
      : null;

  switch (item.changeType) {
    case "ROUTE_ASSIGNED":
      return `Nueva ruta asignada: ${customerName} - ${address} (${to})`;
    case "JOB_ASSIGNED":
      return `Trabajo asignado: ${customerName} - ${address} (${to})`;
    case "JOB_UNASSIGNED":
      return `Trabajo removido: ${customerName} - ${address}`;
    case "ROUTE_REORDERED":
      return `Orden ajustado: ${customerName} - ${address}`;
    case "JOB_RESCHEDULED":
      return `Reprogramado: ${customerName} - ${address} (${from} -> ${to})`;
    default:
      return `Actualizado: ${customerName} - ${address} (${to || "hora pendiente"})`;
  }
};

const buildTechDailyDigest = async ({ techName, label, lines }) =>
  renderTemplateById("TECH_DAILY_DIGEST", {
    tech_name: techName,
    tech_name_html: escapeHtml(techName),
    route_date: label,
    lines_text: buildIndexedLinesText(lines) || "-",
    lines_html: buildIndexedLinesHtml(lines) || "<li>Sin servicios asignados.</li>",
  });

const buildTechChangeDigest = async ({ techName, label, changes }) =>
  renderTemplateById("TECH_CHANGE_DIGEST", {
    tech_name: techName,
    tech_name_html: escapeHtml(techName),
    route_date: label,
    lines_text: buildIndexedLinesText(changes) || "-",
    lines_html: buildIndexedLinesHtml(changes) || "<li>Sin cambios detectados.</li>",
  });

const sendAndLogEmail = async ({
  to,
  toName,
  role,
  subject,
  text,
  html,
  customerId,
  technicianId,
  jobId,
  digestId,
  metadata,
}) => {
  try {
    const { transporter, from } = getTransporter();
    await transporter.sendMail({ from, to, subject, text, html });
    await prisma.emailLog.create({
      data: {
        recipientEmail: to,
        recipientName: toName || null,
        recipientRole: role,
        subject,
        bodyText: text,
        bodyHtml: html || null,
        status: "SENT",
        sentAt: new Date(),
        customerId: customerId || null,
        technicianId: technicianId || null,
        jobId: jobId || null,
        digestId: digestId || null,
        metadata: metadata || null,
      },
    });
    return true;
  } catch (error) {
    await prisma.emailLog.create({
      data: {
        recipientEmail: to,
        recipientName: toName || null,
        recipientRole: role,
        subject,
        bodyText: text,
        bodyHtml: html || null,
        status: "FAILED",
        errorMessage: error?.message || "Send failed",
        customerId: customerId || null,
        technicianId: technicianId || null,
        jobId: jobId || null,
        digestId: digestId || null,
        metadata: metadata || null,
      },
    });
    return false;
  }
};

const processCustomerNotifications = async () => {
  const notifications = await prisma.notification.findMany({
    where: {
      status: "QUEUED",
      channel: "EMAIL",
      eventType: { in: CUSTOMER_EVENTS },
    },
    take: 30,
    include: { customer: true },
  });

  for (const notification of notifications) {
    const payload =
      typeof notification.payload === "object" && notification.payload
        ? notification.payload
        : {};
    const jobId = typeof payload.jobId === "string" ? payload.jobId : null;
    if (!jobId) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED" },
      });
      continue;
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        property: true,
        technician: {
          include: { user: { select: { fullName: true } } },
        },
      },
    });
    if (!job) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED" },
      });
      continue;
    }

    const message = await buildCustomerEmail(notification, job);
    const ok = await sendAndLogEmail({
      to: job.customer.email,
      toName: getCustomerName(job.customer),
      role: "CUSTOMER",
      subject: message.subject,
      text: message.text,
      html: message.html,
      customerId: job.customerId,
      jobId: job.id,
      metadata: { notificationId: notification.id, eventType: notification.eventType },
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: ok ? "SENT" : "FAILED", sentAt: ok ? new Date() : null },
    });
  }
};

const sendDailyPlan = async () => {
  const now = DateTime.now().setZone(TZ);
  const start = now.startOf("day").toJSDate();
  const end = now.endOf("day").toJSDate();
  const label = now.toFormat("MM/dd/yyyy");

  const jobs = await prisma.job.findMany({
    where: {
      scheduledDate: { gte: start, lte: end },
      technicianId: { not: null },
    },
    include: {
      customer: true,
      property: true,
      technician: { include: { user: true } },
    },
    orderBy: { scheduledDate: "asc" },
  });

  const grouped = new Map();
  for (const job of jobs) {
    if (!job.technicianId || !job.technician) {
      continue;
    }
    const entry = grouped.get(job.technicianId) || {
      technician: job.technician,
      jobs: [],
    };
    entry.jobs.push(job);
    grouped.set(job.technicianId, entry);
  }

  for (const [, data] of grouped.entries()) {
    const techName = data.technician.user.fullName;
    const techEmail = data.technician.user.email;
    if (!techEmail) {
      continue;
    }

    const lines = data.jobs.map(buildRouteLine);
    const message = await buildTechDailyDigest({ techName, label, lines });

    const digest = await prisma.techDigest.create({
      data: {
        technicianId: data.technician.id,
        routeDate: start,
        window: "MORNING",
        scheduledFor: new Date(),
        status: "QUEUED",
      },
    });

    const ok = await sendAndLogEmail({
      to: techEmail,
      toName: techName,
      role: "TECH",
      subject: message.subject,
      text: message.text,
      html: message.html,
      technicianId: data.technician.id,
      digestId: digest.id,
    });

    await prisma.techDigest.update({
      where: { id: digest.id },
      data: { status: ok ? "SENT" : "FAILED", sentAt: ok ? new Date() : null },
    });
  }
};

const sendChangeDigest = async (window) => {
  const now = DateTime.now().setZone(TZ);
  const start = now.startOf("day").toJSDate();
  const end = now.endOf("day").toJSDate();
  const label = now.toFormat("MM/dd/yyyy");

  const items = await prisma.techDigestItem.findMany({
    where: {
      digestId: null,
      routeDate: { gte: start, lte: end },
    },
    include: {
      technician: { include: { user: true } },
      job: { include: { customer: true, property: true } },
    },
  });

  const grouped = new Map();
  for (const item of items) {
    const tech = item.technician;
    if (!tech) {
      continue;
    }
    const entry = grouped.get(tech.id) || {
      technician: tech,
      items: [],
    };
    entry.items.push(item);
    grouped.set(tech.id, entry);
  }

  for (const [, data] of grouped.entries()) {
    const techName = data.technician.user.fullName;
    const techEmail = data.technician.user.email;
    if (!techEmail) {
      continue;
    }

    const changes = data.items.map(buildChangeLine);
    const message = await buildTechChangeDigest({ techName, label, changes });

    const digest = await prisma.techDigest.create({
      data: {
        technicianId: data.technician.id,
        routeDate: start,
        window,
        scheduledFor: new Date(),
        status: "QUEUED",
      },
    });

    const ok = await sendAndLogEmail({
      to: techEmail,
      toName: techName,
      role: "TECH",
      subject: message.subject,
      text: message.text,
      html: message.html,
      technicianId: data.technician.id,
      digestId: digest.id,
      metadata: { window },
    });

    await prisma.techDigest.update({
      where: { id: digest.id },
      data: { status: ok ? "SENT" : "FAILED", sentAt: ok ? new Date() : null },
    });

    await prisma.techDigestItem.updateMany({
      where: { id: { in: data.items.map((item) => item.id) } },
      data: { digestId: digest.id },
    });
  }
};

const start = async () => {
  console.log(`[cron-worker] starting with TZ=${TZ}`);
  const runSafely = (label, task) =>
    task().catch((error) =>
      console.error(`[cron-worker] ${label} failed`, error)
    );

  cron.schedule("*/2 * * * *", () => runSafely("customer", processCustomerNotifications), {
    timezone: TZ,
  });

  cron.schedule("30 6 * * *", () => runSafely("morning-digest", sendDailyPlan), {
    timezone: TZ,
  });
  cron.schedule("0 12 * * *", () => runSafely("midday-digest", () => sendChangeDigest("MIDDAY")), {
    timezone: TZ,
  });
  cron.schedule("0 21 * * *", () => runSafely("evening-digest", () => sendChangeDigest("EVENING")), {
    timezone: TZ,
  });
};

start().catch((error) => {
  console.error("[cron-worker] failed to start", error);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
