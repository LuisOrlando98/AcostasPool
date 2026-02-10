const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { DateTime } = require("luxon");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TZ = "America/New_York";
const CUSTOMER_EVENTS = ["SERVICE_SCHEDULED", "SERVICE_RESCHEDULED"];

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

const formatDateTime = (date) =>
  DateTime.fromJSDate(date, { zone: "utc" })
    .setZone(TZ)
    .toFormat("MMM dd, yyyy hh:mm a");

const formatDate = (date) =>
  DateTime.fromJSDate(date, { zone: "utc" }).setZone(TZ).toFormat("MM/dd/yyyy");

const buildCustomerEmail = (notification, job) => {
  const scheduledLabel = formatDateTime(job.scheduledDate);
  if (notification.eventType === "SERVICE_RESCHEDULED") {
    return {
      subject: `Servicio reprogramado - ${formatDate(job.scheduledDate)}`,
      text: [
        `Hola ${job.customer.name},`,
        "",
        `Tu servicio ha sido reprogramado para ${scheduledLabel}.`,
        "Lamentamos el inconveniente y agradecemos tu comprension.",
        "Si tienes dudas, por favor responde a este correo.",
        "",
        `Direccion: ${job.property.address}`,
      ].join("\n"),
    };
  }
  return {
    subject: `Servicio programado - ${formatDate(job.scheduledDate)}`,
    text: [
      `Hola ${job.customer.name},`,
      "",
      `Tu servicio esta programado para ${scheduledLabel}.`,
      "Si necesitas cambiar la fecha, por favor contactanos.",
      "",
      `Direccion: ${job.property.address}`,
    ].join("\n"),
  };
};

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
      include: { customer: true, property: true },
    });
    if (!job) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED" },
      });
      continue;
    }

    const message = buildCustomerEmail(notification, job);
    const ok = await sendAndLogEmail({
      to: job.customer.email,
      toName: job.customer.name,
      role: "CUSTOMER",
      subject: message.subject,
      text: message.text,
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

const buildRouteLine = (job) => {
  const timeLabel = formatDateTime(job.scheduledDate);
  return `${timeLabel} - ${job.customer.name} - ${job.property.address}`;
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
    const subject = `Ruta - ${techName} - ${label}`;
    const text = [
      `Hola ${techName},`,
      "",
      `Esta es tu ruta para hoy (${label}):`,
      ...lines.map((line, index) => `${index + 1}. ${line}`),
      "",
      "Recibiras actualizaciones a las 12:00pm y 9:00pm si hay cambios.",
    ].join("\n");

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
      subject,
      text,
      technicianId: data.technician.id,
      digestId: digest.id,
    });

    await prisma.techDigest.update({
      where: { id: digest.id },
      data: { status: ok ? "SENT" : "FAILED", sentAt: ok ? new Date() : null },
    });
  }
};

const buildChangeLine = (item) => {
  const job = item.job;
  const customerName = job?.customer?.name || "Cliente";
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
    const subject = `Cambios de ruta - ${techName} - ${label}`;
    const text = [
      `Hola ${techName},`,
      "",
      `Cambios detectados en tu ruta del ${label}:`,
      ...changes.map((line, index) => `${index + 1}. ${line}`),
      "",
      "Si necesitas aclaraciones, contacta al administrador.",
    ].join("\n");

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
      subject,
      text,
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
