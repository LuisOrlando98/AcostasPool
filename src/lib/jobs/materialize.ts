import type {
  AccountStatus,
  JobPriority,
  PlanFrequency,
  Prisma,
  ServiceType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";
import { addPlanFrequency } from "@/lib/jobs/scheduling";
import { createNotification } from "@/lib/notifications/create";
import {
  getRouteDayRange,
  queueTechDigestItem,
} from "@/lib/notifications/techDigest";
import { normalizeChecklist } from "@/lib/service-tiers";
import {
  endOfBusinessDay,
  getBusinessTimeParts,
  startOfBusinessDay,
} from "@/lib/timezone";

const MINUTES_PER_HOUR = 60;

/** Marca que el worker cron añade a las notas de los trabajos generados desde un plan. */
export const AUTO_GENERATED_JOB_MARKER = "[Auto generated recurring job]";

/** Estados de trabajo que todavía representan una visita pendiente de realizar. */
export const UPCOMING_JOB_STATUSES = ["SCHEDULED", "PENDING", "ON_THE_WAY"] as const;

/** Cliente Prisma o transacción interactiva: la función no abre conexiones propias. */
export type MaterializeDb = Prisma.TransactionClient;

export type MaterializablePlan = {
  id: string;
  customerId: string;
  propertyId: string;
  technicianId: string | null;
  serviceTierId: string | null;
  serviceType: ServiceType;
  priority: JobPriority;
  frequency: PlanFrequency;
  nextRunAt: Date;
  estimatedDurationMinutes: number | null;
  checklist: Prisma.JsonValue | null;
  notes: string | null;
  isActive: boolean;
  customer: {
    estadoCuenta: AccountStatus;
    pauseServicesFrom: Date | null;
  };
};

export type MaterializeOptions = {
  /** Instante de referencia: define "hoy" para avanzar fechas pasadas y fijar el estado. */
  now: Date;
  /** Ocurrencia concreta a materializar; si falta, la primera >= hoy a partir de `nextRunAt`. */
  scheduledDate?: Date;
  /** Mueve `nextRunAt` del plan una frecuencia más allá de la fecha materializada. */
  advancePlan?: boolean;
};

export type MaterializedJob = Prisma.JobGetPayload<{
  include: { customer: true; property: true };
}>;

type ServiceTierSnapshot = { id: string; checklist: Prisma.JsonValue | null };

const SERVICE_TIER_SNAPSHOT_SELECT = { id: true, checklist: true } as const;

function resolveScheduledDate(
  plan: MaterializablePlan,
  now: Date,
  explicitDate?: Date
) {
  if (explicitDate) {
    return explicitDate;
  }
  const todayStart = startOfBusinessDay(now) ?? now;
  let candidate = plan.nextRunAt;
  while (candidate < todayStart) {
    candidate = addPlanFrequency(candidate, plan.frequency);
  }
  return candidate;
}

/**
 * Criterio del worker: un cliente inactivo o con servicios pausados desde una
 * fecha no recibe visitas a partir de esa fecha.
 */
function isServicePaused(plan: MaterializablePlan, scheduledDate: Date) {
  if (plan.customer.estadoCuenta !== "ACTIVE") {
    return true;
  }
  const pauseFrom = plan.customer.pauseServicesFrom;
  return pauseFrom !== null && scheduledDate.getTime() >= pauseFrom.getTime();
}

function buildJobNotes(planNotes: string | null) {
  return planNotes
    ? `${planNotes}\n${AUTO_GENERATED_JOB_MARKER}`
    : AUTO_GENERATED_JOB_MARKER;
}

function computeSortOrder(scheduledDate: Date) {
  const timeParts = getBusinessTimeParts(scheduledDate);
  return (timeParts?.hour ?? 0) * MINUTES_PER_HOUR + (timeParts?.minute ?? 0);
}

/**
 * Nivel de servicio del trabajo: el del plan si existe; si no, el primero activo
 * y, en último término, el primero creado (misma cadena que `getDefaultServiceTierId`).
 */
async function resolvePlanTier(
  db: MaterializeDb,
  plan: MaterializablePlan
): Promise<ServiceTierSnapshot | null> {
  if (plan.serviceTierId) {
    const assigned = await db.serviceTier.findUnique({
      where: { id: plan.serviceTierId },
      select: SERVICE_TIER_SNAPSHOT_SELECT,
    });
    if (assigned) {
      return assigned;
    }
  }
  const active = await db.serviceTier.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: SERVICE_TIER_SNAPSHOT_SELECT,
  });
  if (active) {
    return active;
  }
  return db.serviceTier.findFirst({
    orderBy: { createdAt: "asc" },
    select: SERVICE_TIER_SNAPSHOT_SELECT,
  });
}

/**
 * Crea el trabajo de una ocurrencia de un plan recurrente.
 *
 * Devuelve null (sin escribir nada) cuando el plan está inactivo, la fecha no es
 * válida, el cliente está inactivo o pausado para esa fecha, o ya existe un
 * trabajo del plan en esa misma fecha. No envía notificaciones: para eso está
 * `queueJobScheduledNotifications`, que debe llamarse fuera de la transacción.
 *
 * Cubre los dos usos actuales: la ficha de cliente (una sola ocurrencia, la
 * primera >= hoy, con `advancePlan`) y el worker cron (una llamada por fecha
 * dentro de su horizonte, pasando `scheduledDate` y actualizando `nextRunAt`
 * al terminar el bucle).
 */
export async function materializeServicePlanJob(
  db: MaterializeDb,
  plan: MaterializablePlan,
  options: MaterializeOptions
): Promise<MaterializedJob | null> {
  if (!plan.isActive) {
    return null;
  }

  const scheduledDate = resolveScheduledDate(plan, options.now, options.scheduledDate);
  if (Number.isNaN(scheduledDate.getTime())) {
    return null;
  }
  if (isServicePaused(plan, scheduledDate)) {
    return null;
  }

  const existingJob = await db.job.findFirst({
    where: { planId: plan.id, scheduledDate },
    select: { id: true },
  });
  if (existingJob) {
    return null;
  }

  const tier = await resolvePlanTier(db, plan);
  const checklist = normalizeChecklist(tier ? tier.checklist : plan.checklist);
  const endOfToday = endOfBusinessDay(options.now) ?? options.now;

  const job = await db.job.create({
    data: {
      customerId: plan.customerId,
      propertyId: plan.propertyId,
      technicianId: plan.technicianId,
      serviceTierId: tier?.id ?? null,
      scheduledDate,
      sortOrder: computeSortOrder(scheduledDate),
      status: scheduledDate > endOfToday ? "SCHEDULED" : "PENDING",
      type: "ROUTINE",
      priority: plan.priority,
      serviceType: plan.serviceType,
      estimatedDurationMinutes: plan.estimatedDurationMinutes,
      checklist,
      notes: buildJobNotes(plan.notes),
      planId: plan.id,
      requestedAt: options.now,
    },
    include: { customer: true, property: true },
  });

  if (options.advancePlan) {
    await db.servicePlan.update({
      where: { id: plan.id },
      data: { nextRunAt: addPlanFrequency(scheduledDate, plan.frequency) },
    });
  }

  return job;
}

/**
 * Avisos que acompañan a un trabajo recién programado: el resumen diario del
 * técnico asignado (si lo hay) y la notificación al cliente. Usa el cliente
 * Prisma global, así que debe ejecutarse una vez confirmada la escritura.
 */
export async function queueJobScheduledNotifications(job: MaterializedJob) {
  if (job.technicianId) {
    const { start, end } = getRouteDayRange(job.scheduledDate);
    const existingCount = await prisma.job.count({
      where: {
        technicianId: job.technicianId,
        scheduledDate: { gte: start, lte: end },
        NOT: { id: job.id },
      },
    });
    await queueTechDigestItem({
      technicianId: job.technicianId,
      jobId: job.id,
      routeDate: job.scheduledDate,
      changeType: existingCount === 0 ? "ROUTE_ASSIGNED" : "JOB_ASSIGNED",
      payload: {
        scheduledDate: job.scheduledDate.toISOString(),
        customerName: formatCustomerName(job.customer),
        address: job.property.address,
      },
    });
  }

  await createNotification({
    customerId: job.customerId,
    recipientRole: "CUSTOMER",
    eventType: "SERVICE_SCHEDULED",
    severity: "INFO",
    payload: {
      jobId: job.id,
      technicianId: job.technicianId,
      scheduledDate: job.scheduledDate.toISOString(),
    },
  });
}

function upcomingPlanJobsWhere(planId: string, now: Date): Prisma.JobWhereInput {
  return {
    planId,
    scheduledDate: { gte: startOfBusinessDay(now) ?? now },
    status: { in: [...UPCOMING_JOB_STATUSES] },
  };
}

/** Visitas del plan aún por realizar desde el inicio del día de negocio de `now`. */
export async function countUpcomingPlanJobs(
  db: MaterializeDb,
  planId: string,
  now: Date
) {
  return db.job.count({ where: upcomingPlanJobsWhere(planId, now) });
}

/**
 * Elimina las visitas pendientes del plan. Las fotos y los items del resumen
 * del técnico caen en cascada; las facturas y los registros de email
 * conservan su fila con `jobId` a null (reglas onDelete del esquema).
 */
export async function deleteUpcomingPlanJobs(
  db: MaterializeDb,
  planId: string,
  now: Date
) {
  const result = await db.job.deleteMany({
    where: upcomingPlanJobsWhere(planId, now),
  });
  return result.count;
}
