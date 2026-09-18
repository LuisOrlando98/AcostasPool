import { NextResponse } from "next/server";
import { JobPriority, JobType, ServiceType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { combineDateAndTime } from "@/lib/jobs/scheduling";
import type { ChecklistItem } from "@/lib/jobs/templates";
import {
  getDefaultServiceTierId,
  getServiceTierChecklist,
} from "@/lib/service-tiers";
import {
  getRouteDayRange,
  queueTechDigestItem,
} from "@/lib/notifications/techDigest";
import { formatCustomerName } from "@/lib/customers/format";
import {
  createNotification,
  type DeferredNotification,
} from "@/lib/notifications/create";
import { logAuditEvent } from "@/lib/audit/log";
import { endOfBusinessDay, getBusinessTimeParts } from "@/lib/timezone";

/**
 * POST /api/jobs/bulk-create
 *
 * Body: { date: "YYYY-MM-DD", jobs: [draft, ...] } con 1..200 borradores (`draftSchema` refleja
 * `toDraftPayload` de RoutesCalendar, incluidos sus opcionales y las cadenas vacías).
 *
 * Respuestas:
 * - 200 { jobs: CalendarJob[] } (forma que consume el calendario; sin cambios).
 * - 400 { error: "Invalid payload", issues } si el body no valida, o
 *   { error: "Invalid property for customer in draft: <propertyId>" } si una propiedad no
 *   pertenece al cliente indicado (se comprueba antes de crear nada).
 *
 * El lote se crea en UNA transacción (todo o nada): un reintento del cliente tras un error no
 * duplica jobs y la respuesta `{ jobs }` siempre refleja lo persistido. Las lecturas previas
 * (propiedades, tiers, checklists) se resuelven antes de abrir la transacción para que dentro solo
 * haya inserciones y counts; el timeout se amplía porque 200 borradores superan el límite
 * interactivo por defecto de Prisma (5 s). Las notificaciones se publican tras el commit.
 */

const MAX_JOBS_PER_REQUEST = 200;
const DEFAULT_SCHEDULED_TIME = "09:00";
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_INPUT_PATTERN = /^\d{1,2}:\d{2}$/;
const MINUTES_PER_HOUR = 60;
const TRANSACTION_TIMEOUT_MS = 60_000;
const TRANSACTION_MAX_WAIT_MS = 5_000;

const optionalText = z.string().nullable().optional();

const draftSchema = z
  .object({
    customerId: z.string().min(1),
    propertyId: z.string().min(1),
    /** "" o null = sin técnico (RoutesCalendar envía "" por defecto). */
    technicianId: optionalText,
    /** HH:mm; "" o ausente = 09:00. */
    scheduledTime: z
      .string()
      .regex(TIME_INPUT_PATTERN)
      .or(z.literal(""))
      .nullable()
      .optional(),
    /** "" o null = tier por defecto. */
    serviceTierId: optionalText,
    serviceType: z.nativeEnum(ServiceType).optional(),
    priority: z.nativeEnum(JobPriority).optional(),
    type: z.nativeEnum(JobType).optional(),
    estimatedDurationMinutes: z.number().int().min(0).nullable().optional(),
    notes: optionalText,
  })
  .strict();

const bodySchema = z
  .object({
    date: z.string().regex(DATE_INPUT_PATTERN),
    jobs: z.array(draftSchema).min(1).max(MAX_JOBS_PER_REQUEST),
  })
  .strict()
  .superRefine((body, ctx) => {
    body.jobs.forEach((draft, index) => {
      const scheduledDate = combineDateAndTime(
        body.date,
        draft.scheduledTime || DEFAULT_SCHEDULED_TIME
      );
      if (Number.isNaN(scheduledDate.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["jobs", index, "scheduledTime"],
          message: "Invalid date or time",
        });
      }
    });
  });

type Draft = z.infer<typeof draftSchema>;

const CREATED_JOB_INCLUDE = {
  customer: true,
  property: true,
  technician: { include: { user: true } },
} satisfies Prisma.JobInclude;

type CreatedJob = Prisma.JobGetPayload<{ include: typeof CREATED_JOB_INCLUDE }>;

type CreatedEntry = { job: CreatedJob; notifications: DeferredNotification[] };

/** Forma de cada elemento de `jobs` en la respuesta (contrato con RoutesCalendar). */
type CalendarJob = {
  id: string;
  scheduledDate: string;
  entryKind: "job";
  status: string;
  type: string;
  priority: string;
  serviceTierId: string | null;
  serviceType: string;
  estimatedDurationMinutes: number | null;
  technicianId: string | null;
  sortOrder?: number | null;
  planId?: string | null;
  planName?: string | null;
  showScheduledTime: boolean;
  notes?: string | null;
  checklist?: { label?: string; completed?: boolean }[] | null;
  customer: { id: string; name: string; email?: string | null; phone?: string | null };
  property: {
    id: string;
    name?: string | null;
    address: string;
    poolType?: string | null;
    waterType?: string | null;
    sanitizerType?: string | null;
    poolVolumeGallons?: number | null;
    filterType?: string | null;
    accessInfo?: string | null;
    locationNotes?: string | null;
    hasSpa?: boolean | null;
  };
  technician: { id: string; name: string } | null;
};

const resolveTierId = (draft: Draft, defaultTierId: string | null) =>
  draft.serviceTierId?.trim() || defaultTierId;

async function loadPropertyOwners(drafts: readonly Draft[]) {
  const propertyIds = [...new Set(drafts.map((draft) => draft.propertyId))];
  const properties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: { id: true, customerId: true },
  });
  return new Map(properties.map((property) => [property.id, property.customerId]));
}

async function loadChecklists(
  drafts: readonly Draft[],
  defaultTierId: string | null
): Promise<ReadonlyMap<string | null, ChecklistItem[]>> {
  const tierIds = [...new Set(drafts.map((draft) => resolveTierId(draft, defaultTierId)))];
  const entries = await Promise.all(
    tierIds.map(async (tierId) => [tierId, await getServiceTierChecklist(tierId)] as const)
  );
  return new Map(entries);
}

function buildJobData(
  draft: Draft,
  date: string,
  endOfToday: Date,
  defaultTierId: string | null,
  checklists: ReadonlyMap<string | null, ChecklistItem[]>
): Prisma.JobUncheckedCreateInput {
  const scheduledDate = combineDateAndTime(
    date,
    draft.scheduledTime || DEFAULT_SCHEDULED_TIME
  );
  const timeParts = getBusinessTimeParts(scheduledDate);
  const serviceTierId = resolveTierId(draft, defaultTierId);
  return {
    customerId: draft.customerId,
    propertyId: draft.propertyId,
    technicianId: draft.technicianId || null,
    scheduledDate,
    sortOrder: (timeParts?.hour ?? 0) * MINUTES_PER_HOUR + (timeParts?.minute ?? 0),
    status: scheduledDate > endOfToday ? "SCHEDULED" : "PENDING",
    type: draft.type ?? "ROUTINE",
    priority: draft.priority ?? "NORMAL",
    serviceTierId,
    serviceType: draft.serviceType ?? "WEEKLY_CLEANING",
    estimatedDurationMinutes: draft.estimatedDurationMinutes ?? null,
    notes: draft.notes || null,
    checklist: checklists.get(serviceTierId) ?? [],
  };
}

async function queueAssignmentDigest(
  tx: Prisma.TransactionClient,
  job: CreatedJob,
  technicianId: string,
  customerName: string
) {
  const { start, end } = getRouteDayRange(job.scheduledDate);
  const otherJobsOnRoute = await tx.job.count({
    where: {
      technicianId,
      scheduledDate: { gte: start, lte: end },
      NOT: { id: job.id },
    },
  });
  await queueTechDigestItem({
    tx,
    technicianId,
    jobId: job.id,
    routeDate: job.scheduledDate,
    changeType: otherJobsOnRoute === 0 ? "ROUTE_ASSIGNED" : "JOB_ASSIGNED",
    payload: {
      scheduledDate: job.scheduledDate.toISOString(),
      customerName,
      address: job.property.address,
    },
  });
}

async function createJobWithSideEffects(
  tx: Prisma.TransactionClient,
  data: Prisma.JobUncheckedCreateInput,
  actorUserId: string
): Promise<CreatedEntry> {
  const job = await tx.job.create({ data, include: CREATED_JOB_INCLUDE });
  const customerName = formatCustomerName(job.customer);
  const scheduledDate = job.scheduledDate.toISOString();

  if (job.technicianId) {
    await queueAssignmentDigest(tx, job, job.technicianId, customerName);
  }

  const customerNotification = await createNotification({
    tx,
    customerId: job.customerId,
    recipientRole: "CUSTOMER",
    eventType: "SERVICE_SCHEDULED",
    severity: "INFO",
    actorUserId,
    payload: { jobId: job.id, technicianId: job.technicianId, scheduledDate },
  });

  const techNotification = job.technician?.userId
    ? await createNotification({
        tx,
        customerId: job.customerId,
        recipientRole: "TECH",
        recipientUserId: job.technician.userId,
        eventType: "ROUTE_UPDATED",
        severity: "INFO",
        actorUserId,
        payload: {
          jobId: job.id,
          technicianId: job.technician.id,
          customerName,
          address: job.property.address,
          scheduledDate,
          changeType: "ASSIGNED",
        },
      })
    : null;

  return {
    job,
    notifications: techNotification
      ? [customerNotification, techNotification]
      : [customerNotification],
  };
}

function toCalendarJob(job: CreatedJob): CalendarJob {
  return {
    id: job.id,
    scheduledDate: job.scheduledDate.toISOString(),
    entryKind: "job",
    status: job.status,
    type: job.type,
    priority: job.priority,
    serviceTierId: job.serviceTierId ?? null,
    serviceType: job.serviceType,
    estimatedDurationMinutes: job.estimatedDurationMinutes,
    technicianId: job.technicianId,
    sortOrder: job.sortOrder,
    planId: job.planId ?? null,
    planName: null,
    showScheduledTime: false,
    notes: job.notes ?? null,
    checklist: Array.isArray(job.checklist)
      ? (job.checklist as Array<{ label?: string; completed?: boolean }>)
      : null,
    customer: {
      id: job.customer.id,
      name: formatCustomerName(job.customer),
      email: job.customer.email,
      phone: job.customer.telefono,
    },
    property: {
      id: job.property.id,
      name: job.property.name,
      address: job.property.address,
      poolType: job.property.poolType,
      waterType: job.property.waterType,
      sanitizerType: job.property.sanitizerType,
      poolVolumeGallons: job.property.poolVolumeGallons,
      filterType: job.property.filterType,
      accessInfo: job.property.accessInfo,
      locationNotes: job.property.locationNotes,
      hasSpa: job.property.hasSpa,
    },
    technician: job.technician
      ? { id: job.technician.id, name: job.technician.user.fullName }
      : null,
  };
}

type Actor = { sub: string; email: string; name: string };

/** Crea el lote en una transacción (con su auditoría) y publica en tiempo real tras el commit. */
async function createBatch(
  jobsData: readonly Prisma.JobUncheckedCreateInput[],
  date: string,
  actor: Actor
): Promise<CreatedEntry[]> {
  const created = await prisma.$transaction(
    async (tx) => {
      let entries: CreatedEntry[] = [];
      for (const data of jobsData) {
        entries = [...entries, await createJobWithSideEffects(tx, data, actor.sub)];
      }
      await logAuditEvent({
        tx,
        userId: actor.sub,
        actorEmail: actor.email,
        actorName: actor.name,
        action: "JOBS_BULK_CREATED",
        entity: "Job",
        metadata: {
          count: entries.length,
          jobIds: entries.map((entry) => entry.job.id),
          date,
        },
      });
      return entries;
    },
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS }
  );

  // Tiempo real solo tras el commit; cada publish() aísla sus propios fallos.
  await Promise.all(
    created.flatMap((entry) => entry.notifications).map((item) => item.publish())
  );
  return created;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { date, jobs: drafts } = parsed.data;

  const ownersByProperty = await loadPropertyOwners(drafts);
  const invalidDraft = drafts.find(
    (draft) => ownersByProperty.get(draft.propertyId) !== draft.customerId
  );
  if (invalidDraft) {
    return NextResponse.json(
      { error: `Invalid property for customer in draft: ${invalidDraft.propertyId}` },
      { status: 400 }
    );
  }

  const defaultTierId = await getDefaultServiceTierId();
  const checklists = await loadChecklists(drafts, defaultTierId);
  const endOfToday = endOfBusinessDay(new Date()) ?? new Date();
  const jobsData = drafts.map((draft) =>
    buildJobData(draft, date, endOfToday, defaultTierId, checklists)
  );

  const created = await createBatch(jobsData, date, session);
  return NextResponse.json({ jobs: created.map((entry) => toCalendarJob(entry.job)) });
}
