import type { Prisma } from "@prisma/client";
import { formatCustomerName } from "@/lib/customers/format";
import {
  escapeHtml,
  resolveEmailTemplateLocale,
  type EmailTemplateId,
} from "@/lib/email-templates";
import {
  CUSTOMER_NOTIFICATION_EVENTS,
  MAX_SEND_ATTEMPTS,
  NOTIFICATION_BATCH_SIZE,
  PROCESSING_ORPHAN_THRESHOLD_MS,
  type CustomerNotificationEvent,
} from "@/lib/worker/constants";
import { renderWorkerTemplate } from "@/lib/worker/email-templates";
import { DEFAULT_TECHNICIAN_NAME, formatDateTimeLabel } from "@/lib/worker/format";
import { asRecord, readDate, readString } from "@/lib/worker/payload";
import { isRetryDue } from "@/lib/worker/retry";
import type { WorkerTaskDeps } from "@/lib/worker/types";

/**
 * Correos a clientes a partir de Notification (channel EMAIL, rol CUSTOMER).
 *
 * Idempotencia: cada tick (1) devuelve a QUEUED los PROCESSING huérfanos,
 * (2) reencola los FAILED con intentos restantes cuyo backoff venció,
 * (3) reclama un lote QUEUED con un updateMany atómico (PROCESSING, attempts+1,
 * lastAttemptAt = now) y (4) procesa solo las filas que ese updateMany marcó.
 * Cada fila termina en SENT o FAILED; un reinicio o un tick solapado no reenvía.
 */

export type CustomerNotificationSummary = {
  /** PROCESSING huérfanos devueltos a QUEUED. */
  readonly recovered: number;
  /** PROCESSING huérfanos sin intentos restantes, marcados FAILED. */
  readonly exhausted: number;
  /** FAILED reencolados para reintento. */
  readonly retried: number;
  readonly claimed: number;
  readonly sent: number;
  readonly failed: number;
};

type DeliveryStatus = "SENT" | "FAILED";

const CUSTOMER_EMAIL_WHERE = {
  channel: "EMAIL",
  recipientRole: "CUSTOMER",
  eventType: { in: [...CUSTOMER_NOTIFICATION_EVENTS] },
} as const satisfies Prisma.NotificationWhereInput;

const TEMPLATE_BY_EVENT: Record<CustomerNotificationEvent, EmailTemplateId> = {
  SERVICE_SCHEDULED: "CUSTOMER_SERVICE_SCHEDULED",
  SERVICE_RESCHEDULED: "CUSTOMER_SERVICE_RESCHEDULED",
  JOB_COMPLETED: "CUSTOMER_JOB_COMPLETED",
};

const CLAIMED_NOTIFICATION_SELECT = {
  id: true,
  eventType: true,
  payload: true,
  attempts: true,
  createdAt: true,
} as const satisfies Prisma.NotificationSelect;
type ClaimedNotification = Prisma.NotificationGetPayload<{
  select: typeof CLAIMED_NOTIFICATION_SELECT;
}>;

const NOTIFICATION_JOB_SELECT = {
  id: true,
  customerId: true,
  scheduledDate: true,
  completedAt: true,
  customer: {
    select: { nombre: true, apellidos: true, email: true, idiomaPreferencia: true },
  },
  property: { select: { address: true } },
  technician: { select: { user: { select: { fullName: true } } } },
} as const satisfies Prisma.JobSelect;
type NotificationJob = Prisma.JobGetPayload<{ select: typeof NOTIFICATION_JOB_SELECT }>;

function isCustomerEvent(eventType: string): eventType is CustomerNotificationEvent {
  return CUSTOMER_NOTIFICATION_EVENTS.some((event) => event === eventType);
}

async function recoverOrphans(deps: WorkerTaskDeps) {
  const { db, logger, now } = deps;
  const staleBefore = new Date(now.getTime() - PROCESSING_ORPHAN_THRESHOLD_MS);
  const staleWhere: Prisma.NotificationWhereInput = {
    ...CUSTOMER_EMAIL_WHERE,
    status: "PROCESSING",
    OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: staleBefore } }],
  };
  const exhausted = await db.notification.updateMany({
    where: { ...staleWhere, attempts: { gte: MAX_SEND_ATTEMPTS } },
    data: { status: "FAILED" },
  });
  const recovered = await db.notification.updateMany({
    where: { ...staleWhere, attempts: { lt: MAX_SEND_ATTEMPTS } },
    data: { status: "QUEUED" },
  });
  if (recovered.count > 0 || exhausted.count > 0) {
    logger.warn("orphaned PROCESSING notifications recovered", {
      requeued: recovered.count,
      failed: exhausted.count,
    });
  }
  return { recovered: recovered.count, exhausted: exhausted.count };
}

/** Solo se reintentan filas con `attempts > 0`: las FAILED heredadas sin contador se dejan como están. */
async function requeueRetryable(deps: WorkerTaskDeps): Promise<number> {
  const { db, now } = deps;
  const candidates = await db.notification.findMany({
    where: {
      ...CUSTOMER_EMAIL_WHERE,
      status: "FAILED",
      attempts: { gt: 0, lt: MAX_SEND_ATTEMPTS },
    },
    select: { id: true, attempts: true, lastAttemptAt: true },
    orderBy: { lastAttemptAt: "asc" },
    take: NOTIFICATION_BATCH_SIZE,
  });
  const dueIds = candidates
    .filter((candidate) => isRetryDue(candidate.attempts, candidate.lastAttemptAt, now))
    .map((candidate) => candidate.id);
  if (dueIds.length === 0) {
    return 0;
  }
  const result = await db.notification.updateMany({
    where: { id: { in: dueIds }, status: "FAILED" },
    data: { status: "QUEUED" },
  });
  return result.count;
}

async function claimBatch(deps: WorkerTaskDeps): Promise<readonly ClaimedNotification[]> {
  const { db, now } = deps;
  const queued = await db.notification.findMany({
    where: { ...CUSTOMER_EMAIL_WHERE, status: "QUEUED" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: NOTIFICATION_BATCH_SIZE,
  });
  if (queued.length === 0) {
    return [];
  }
  const ids = queued.map((row) => row.id);
  await db.notification.updateMany({
    where: { id: { in: ids }, status: "QUEUED" },
    data: { status: "PROCESSING", lastAttemptAt: now, attempts: { increment: 1 } },
  });
  // Solo las filas cuya marca coincide con este tick fueron reclamadas por él.
  return db.notification.findMany({
    where: { id: { in: ids }, status: "PROCESSING", lastAttemptAt: now },
    select: CLAIMED_NOTIFICATION_SELECT,
  });
}

async function buildCustomerEmail(
  deps: WorkerTaskDeps,
  notification: ClaimedNotification,
  job: NotificationJob,
  templateId: EmailTemplateId
) {
  const locale = resolveEmailTemplateLocale(job.customer.idiomaPreferencia);
  const payload = asRecord(notification.payload);
  const completedAt =
    readDate(payload, "completedAt") ?? job.completedAt ?? notification.createdAt;
  const technicianName =
    readString(payload, "technicianName") ??
    job.technician?.user.fullName ??
    DEFAULT_TECHNICIAN_NAME;
  const customerName = formatCustomerName(job.customer);
  const scheduledLabel = formatDateTimeLabel(job.scheduledDate, locale);
  const completedLabel = formatDateTimeLabel(completedAt, locale);
  const templates = await deps.templates.load(deps.now);

  return renderWorkerTemplate(templates, templateId, locale, {
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
  });
}

async function deliver(
  deps: WorkerTaskDeps,
  notification: ClaimedNotification
): Promise<DeliveryStatus> {
  const { db, logger, mailer } = deps;
  const context = { notificationId: notification.id, eventType: notification.eventType };

  if (!isCustomerEvent(notification.eventType)) {
    logger.warn("notification event has no customer template", context);
    return "FAILED";
  }
  const jobId = readString(asRecord(notification.payload), "jobId");
  if (!jobId) {
    logger.warn("notification payload has no jobId", context);
    return "FAILED";
  }
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: NOTIFICATION_JOB_SELECT,
  });
  if (!job) {
    logger.warn("notification job not found", { ...context, jobId });
    return "FAILED";
  }
  const to = job.customer.email.trim();
  if (!to) {
    logger.warn("customer has no e-mail address", { ...context, jobId });
    return "FAILED";
  }

  const templateId = TEMPLATE_BY_EVENT[notification.eventType];
  const message = await buildCustomerEmail(deps, notification, job, templateId);
  const result = await mailer({
    to,
    recipientName: formatCustomerName(job.customer),
    recipientRole: "CUSTOMER",
    template: templateId,
    subject: message.subject,
    text: message.text,
    html: message.html,
    customerId: job.customerId,
    jobId: job.id,
    metadata: { ...context, attempt: notification.attempts },
  });
  if (!result.ok) {
    logger.warn("customer e-mail not sent", {
      ...context,
      attempt: notification.attempts,
      reason: result.reason,
      error: result.error,
    });
  }
  return result.ok ? "SENT" : "FAILED";
}

async function deliverSafely(
  deps: WorkerTaskDeps,
  notification: ClaimedNotification
): Promise<DeliveryStatus> {
  try {
    return await deliver(deps, notification);
  } catch (error) {
    deps.logger.error("customer notification processing failed", {
      notificationId: notification.id,
      error,
    });
    return "FAILED";
  }
}

export async function processCustomerNotifications(
  deps: WorkerTaskDeps
): Promise<CustomerNotificationSummary> {
  const { db, now } = deps;
  const orphans = await recoverOrphans(deps);
  const retried = await requeueRetryable(deps);
  const claimed = await claimBatch(deps);

  let sent = 0;
  let failed = 0;
  for (const notification of claimed) {
    const status = await deliverSafely(deps, notification);
    await db.notification.update({
      where: { id: notification.id },
      data: { status, sentAt: status === "SENT" ? now : null },
    });
    if (status === "SENT") {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return { ...orphans, retried, claimed: claimed.length, sent, failed };
}
