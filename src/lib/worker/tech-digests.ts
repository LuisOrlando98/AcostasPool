import type { DigestWindow, Prisma } from "@prisma/client";
import { escapeHtml, type EmailTemplateContent, type EmailTemplateId } from "@/lib/email-templates";
import { getRouteDayRange } from "@/lib/notifications/techDigest";
import {
  PROCESSING_ORPHAN_THRESHOLD_MS,
  type ChangeDigestWindow,
} from "@/lib/worker/constants";
import { renderWorkerTemplate } from "@/lib/worker/email-templates";
import {
  buildIndexedLinesHtml,
  buildIndexedLinesText,
  formatRouteDateLabel,
} from "@/lib/worker/format";
import { isRetryDue } from "@/lib/worker/retry";
import {
  buildChangeLine,
  buildRouteLine,
  DIGEST_ITEM_SELECT,
  groupByKey,
  ROUTE_JOB_SELECT,
  TECHNICIAN_CONTACT_SELECT,
  type TechnicianContact,
} from "@/lib/worker/tech-digest-content";
import type { WorkerTaskDeps } from "@/lib/worker/types";

/**
 * Digests de técnicos: plan diario (MORNING) y cambios de ruta (MIDDAY, EVENING).
 *
 * Idempotencia: la fila TechDigest se busca por (technicianId, routeDate, window)
 * y se reutiliza; una fila SENT no se reenvía y una PROCESSING reciente se
 * considera en curso. El contenido se renderiza siempre desde la base de datos
 * (trabajos del día o items enlazados al digest), así el primer envío y los
 * reintentos comparten el mismo camino.
 */

export type DigestSummary = {
  readonly sent: number;
  readonly failed: number;
  readonly skipped: number;
};

type DigestOutcome = "sent" | "failed" | "skipped";

const DIGEST_SELECT = {
  id: true,
  technicianId: true,
  routeDate: true,
  window: true,
  status: true,
  updatedAt: true,
} as const satisfies Prisma.TechDigestSelect;
type DigestRow = Prisma.TechDigestGetPayload<{ select: typeof DIGEST_SELECT }>;

type DigestKey = {
  readonly technicianId: string;
  readonly routeDate: Date;
  readonly window: DigestWindow;
};

const TEMPLATE_BY_WINDOW: Record<DigestWindow, EmailTemplateId> = {
  MORNING: "TECH_DAILY_DIGEST",
  MIDDAY: "TECH_CHANGE_DIGEST",
  EVENING: "TECH_CHANGE_DIGEST",
};
const EMPTY_LINE_BY_WINDOW: Record<DigestWindow, string> = {
  MORNING: "Sin servicios asignados.",
  MIDDAY: "Sin cambios detectados.",
  EVENING: "Sin cambios detectados.",
};
const EMPTY_LINES_TEXT = "-";
/** Los digests se renderizan con la plantilla EN (los textos TECH_* por defecto son iguales en EN y ES). */
const DIGEST_TEMPLATE_LOCALE = "EN";
const EMPTY_SUMMARY: DigestSummary = { sent: 0, failed: 0, skipped: 0 };

function isInProgress(digest: DigestRow, now: Date): boolean {
  return (
    digest.status === "PROCESSING" &&
    now.getTime() - digest.updatedAt.getTime() < PROCESSING_ORPHAN_THRESHOLD_MS
  );
}

function addOutcome(summary: DigestSummary, outcome: DigestOutcome): DigestSummary {
  return { ...summary, [outcome]: summary[outcome] + 1 };
}

async function loadRouteLines(deps: WorkerTaskDeps, technicianId: string) {
  const { start, end } = getRouteDayRange(deps.now);
  const jobs = await deps.db.job.findMany({
    where: { technicianId, scheduledDate: { gte: start, lte: end } },
    select: ROUTE_JOB_SELECT,
    orderBy: { scheduledDate: "asc" },
  });
  return jobs.map(buildRouteLine);
}

async function loadChangeLines(deps: WorkerTaskDeps, digestId: string) {
  const items = await deps.db.techDigestItem.findMany({
    where: { digestId },
    select: DIGEST_ITEM_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return items.map(buildChangeLine);
}

async function renderDigest(
  deps: WorkerTaskDeps,
  digest: DigestRow,
  techName: string
): Promise<EmailTemplateContent> {
  const lines =
    digest.window === "MORNING"
      ? await loadRouteLines(deps, digest.technicianId)
      : await loadChangeLines(deps, digest.id);
  const templates = await deps.templates.load(deps.now);
  return renderWorkerTemplate(templates, TEMPLATE_BY_WINDOW[digest.window], DIGEST_TEMPLATE_LOCALE, {
    tech_name: techName,
    tech_name_html: escapeHtml(techName),
    route_date: formatRouteDateLabel(digest.routeDate),
    lines_text: buildIndexedLinesText(lines) || EMPTY_LINES_TEXT,
    lines_html: buildIndexedLinesHtml(lines) || `<li>${EMPTY_LINE_BY_WINDOW[digest.window]}</li>`,
  });
}

function markProcessing(deps: WorkerTaskDeps, digestId: string) {
  return deps.db.techDigest.update({
    where: { id: digestId },
    data: { status: "PROCESSING", scheduledFor: deps.now },
    select: DIGEST_SELECT,
  });
}

/** Reutiliza la fila de la clave única o la crea; null si ya se envió o si otro proceso la está enviando. */
async function claimDigest(deps: WorkerTaskDeps, key: DigestKey): Promise<DigestRow | null> {
  const existing = await deps.db.techDigest.findFirst({ where: key, select: DIGEST_SELECT });
  if (existing && (existing.status === "SENT" || isInProgress(existing, deps.now))) {
    return null;
  }
  if (existing) {
    return markProcessing(deps, existing.id);
  }
  return deps.db.techDigest.create({
    data: { ...key, status: "PROCESSING", scheduledFor: deps.now },
    select: DIGEST_SELECT,
  });
}

async function deliverDigest(
  deps: WorkerTaskDeps,
  digest: DigestRow,
  contact: TechnicianContact
): Promise<boolean> {
  const { db, logger, mailer, now } = deps;
  const techName = contact.user.fullName;
  const templateId = TEMPLATE_BY_WINDOW[digest.window];
  const message = await renderDigest(deps, digest, techName);
  const result = await mailer({
    to: contact.user.email,
    recipientName: techName,
    recipientRole: "TECH",
    template: templateId,
    subject: message.subject,
    text: message.text,
    html: message.html,
    technicianId: digest.technicianId,
    digestId: digest.id,
    metadata: { window: digest.window },
  });
  if (!result.ok) {
    logger.warn("tech digest e-mail not sent", {
      digestId: digest.id,
      window: digest.window,
      reason: result.reason,
      error: result.error,
    });
  }
  await db.techDigest.update({
    where: { id: digest.id },
    data: { status: result.ok ? "SENT" : "FAILED", sentAt: result.ok ? now : null },
  });
  return result.ok;
}

async function deliverSafely(
  deps: WorkerTaskDeps,
  digest: DigestRow,
  contact: TechnicianContact
): Promise<DigestOutcome> {
  try {
    return (await deliverDigest(deps, digest, contact)) ? "sent" : "failed";
  } catch (error) {
    deps.logger.error("tech digest processing failed", { digestId: digest.id, error });
    return "failed";
  }
}

/** Reclama el digest del técnico para la ventana, enlaza los items indicados y lo envía. */
async function sendDigestTo(
  deps: WorkerTaskDeps,
  contact: TechnicianContact,
  key: DigestKey,
  itemIds: readonly string[]
): Promise<DigestOutcome> {
  const { db, logger } = deps;
  const context = { technicianId: contact.id, window: key.window };
  if (!contact.user.email.trim()) {
    logger.warn("technician has no e-mail address; digest skipped", context);
    return "skipped";
  }
  const digest = await claimDigest(deps, key);
  if (!digest) {
    logger.info("digest already sent or in progress; skipped", context);
    return "skipped";
  }
  if (itemIds.length > 0) {
    await db.techDigestItem.updateMany({
      where: { id: { in: [...itemIds] } },
      data: { digestId: digest.id },
    });
  }
  return deliverSafely(deps, digest, contact);
}

/** Plan diario (ventana MORNING): un digest por técnico con trabajos asignados hoy. */
export async function sendDailyPlan(deps: WorkerTaskDeps): Promise<DigestSummary> {
  const { start, end } = getRouteDayRange(deps.now);
  const jobs = await deps.db.job.findMany({
    where: { scheduledDate: { gte: start, lte: end }, technicianId: { not: null } },
    select: { technicianId: true, technician: { select: TECHNICIAN_CONTACT_SELECT } },
    distinct: ["technicianId"],
    orderBy: { scheduledDate: "asc" },
  });
  const contacts = jobs.flatMap((job) => (job.technician ? [job.technician] : []));

  let summary = EMPTY_SUMMARY;
  for (const contact of contacts) {
    const key: DigestKey = { technicianId: contact.id, routeDate: start, window: "MORNING" };
    summary = addOutcome(summary, await sendDigestTo(deps, contact, key, []));
  }
  return summary;
}

/** Digest de cambios: items del día todavía sin digest, agrupados por técnico. */
export async function sendChangeDigest(
  deps: WorkerTaskDeps,
  window: ChangeDigestWindow
): Promise<DigestSummary> {
  const { start, end } = getRouteDayRange(deps.now);
  const items = await deps.db.techDigestItem.findMany({
    where: { digestId: null, routeDate: { gte: start, lte: end } },
    select: { id: true, technicianId: true, technician: { select: TECHNICIAN_CONTACT_SELECT } },
    orderBy: { createdAt: "asc" },
  });
  const groups = groupByKey(items, (item) => item.technicianId);

  let summary = EMPTY_SUMMARY;
  for (const technicianItems of Object.values(groups)) {
    const contact = technicianItems[0].technician;
    const key: DigestKey = { technicianId: contact.id, routeDate: start, window };
    const itemIds = technicianItems.map((item) => item.id);
    summary = addOutcome(summary, await sendDigestTo(deps, contact, key, itemIds));
  }
  return summary;
}

/**
 * Reintenta los digests de hoy en FAILED (o PROCESSING huérfanos) con backoff
 * exponencial; los intentos se cuentan por las filas EmailLog del digest.
 */
export async function retryFailedDigests(deps: WorkerTaskDeps): Promise<DigestSummary> {
  const { db, now } = deps;
  const { start, end } = getRouteDayRange(now);
  const candidates = await db.techDigest.findMany({
    where: { routeDate: { gte: start, lte: end }, status: { in: ["FAILED", "PROCESSING"] } },
    select: { ...DIGEST_SELECT, technician: { select: TECHNICIAN_CONTACT_SELECT } },
    orderBy: { updatedAt: "asc" },
  });

  let summary = EMPTY_SUMMARY;
  for (const candidate of candidates) {
    if (isInProgress(candidate, now) || !candidate.technician.user.email.trim()) {
      continue;
    }
    const attempts = await db.emailLog.count({ where: { digestId: candidate.id } });
    if (!isRetryDue(attempts, candidate.updatedAt, now)) {
      continue;
    }
    const digest = await markProcessing(deps, candidate.id);
    summary = addOutcome(summary, await deliverSafely(deps, digest, candidate.technician));
  }
  return summary;
}
