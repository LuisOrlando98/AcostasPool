import type { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";
import {
  buildRecurringRouteGroupId,
  buildRecurringRouteGroupLabel,
  isGlobalRecurringPlanName,
} from "@/lib/jobs/recurring-plan-templates";
import { geocodeProperties, type GeoPoint } from "@/lib/routing/geo";
import type {
  RouteAssistantJob,
  RouteAssistantTechnician,
} from "@/lib/routing/planner";

/** Estados de trabajo que el asistente de rutas tiene en cuenta. */
export const ROUTE_ASSISTANT_JOB_STATUSES = [
  "SCHEDULED",
  "PENDING",
  "ON_THE_WAY",
  "IN_PROGRESS",
] as const satisfies readonly JobStatus[];

export const routeAssistantJobSelect = {
  id: true,
  scheduledDate: true,
  technicianId: true,
  estimatedDurationMinutes: true,
  customer: {
    select: {
      nombre: true,
      apellidos: true,
    },
  },
  property: {
    select: {
      id: true,
      address: true,
      lat: true,
      lng: true,
      geocodedAt: true,
    },
  },
  plan: {
    select: {
      id: true,
      name: true,
      technicianId: true,
    },
  },
} satisfies Prisma.JobSelect;

const routeAssistantJobOrderBy = [
  { scheduledDate: "asc" },
  { sortOrder: "asc" },
] satisfies Prisma.JobOrderByWithRelationInput[];

export type RouteAssistantJobRecord = Prisma.JobGetPayload<{
  select: typeof routeAssistantJobSelect;
}>;

export type LoadRouteAssistantJobsParams = {
  where: Prisma.JobWhereInput;
  /**
   * Técnicos para las etiquetas de grupo y la planificación. Si se omite se
   * resuelven los técnicos activos referenciados por los propios trabajos.
   */
  technicians?: RouteAssistantTechnician[];
  /** Filtro en memoria aplicado antes de geocodificar (ahorra cuota). */
  filter?: (record: RouteAssistantJobRecord) => boolean;
};

export type RouteAssistantJobSource = {
  /** Registros cargados (tras aplicar `filter`). */
  records: RouteAssistantJobRecord[];
  technicians: RouteAssistantTechnician[];
  /** Trabajos listos para el planificador; vacío si no hay técnicos. */
  jobs: RouteAssistantJob[];
};

/** Técnico efectivo de un trabajo: el del plan recurrente o el asignado. */
export function getEffectiveTechnicianId(record: RouteAssistantJobRecord) {
  return record.plan?.technicianId ?? record.technicianId ?? null;
}

export function getRouteAssistantTechnicianIds(
  records: RouteAssistantJobRecord[]
) {
  return Array.from(
    new Set(
      records
        .map(getEffectiveTechnicianId)
        .filter((value): value is string => Boolean(value))
    )
  );
}

/**
 * Técnicos activos ordenados por nombre. Con `ids` se limita a esos técnicos
 * (una lista vacía devuelve [] sin consultar); con null se devuelven todos.
 */
export async function findRouteAssistantTechnicians(
  ids: string[] | null
): Promise<RouteAssistantTechnician[]> {
  if (ids && ids.length === 0) {
    return [];
  }
  const technicians = await prisma.technician.findMany({
    where: {
      user: { isActive: true },
      ...(ids ? { id: { in: ids } } : {}),
    },
    orderBy: { user: { fullName: "asc" } },
    select: {
      id: true,
      user: { select: { fullName: true } },
    },
  });
  return technicians.map((technician) => ({
    id: technician.id,
    name: technician.user.fullName,
  }));
}

function toRouteAssistantJob(
  record: RouteAssistantJobRecord,
  technicianNamesById: Map<string, string>,
  coordinates: GeoPoint | null
): RouteAssistantJob {
  const planName = record.plan?.name ?? null;
  const planTechnicianId = getEffectiveTechnicianId(record);
  const planTechnicianName = planTechnicianId
    ? technicianNamesById.get(planTechnicianId) ?? null
    : null;
  return {
    id: record.id,
    customerName: formatCustomerName(record.customer),
    address: record.property.address,
    technicianId: record.technicianId,
    planName,
    routeGroupId: planName
      ? buildRecurringRouteGroupId({ planName, technicianId: planTechnicianId })
      : null,
    routeGroupLabel: planName
      ? buildRecurringRouteGroupLabel({
          planName,
          technicianName: planTechnicianName,
        })
      : null,
    lockedTechnicianId:
      planName && isGlobalRecurringPlanName(planName) ? planTechnicianId : null,
    scheduledDate: record.scheduledDate,
    estimatedDurationMinutes: record.estimatedDurationMinutes,
    coordinates,
  };
}

/**
 * Carga los trabajos del asistente de rutas, resuelve sus coordenadas a partir
 * de las persistidas en Property (geocodificando solo las que faltan) y los
 * convierte en RouteAssistantJob. Es la única fuente de jobs para las rutas del
 * asistente (plan manual y auto-optimización).
 */
export async function loadRouteAssistantJobs(
  params: LoadRouteAssistantJobsParams
): Promise<RouteAssistantJobSource> {
  const loaded = await prisma.job.findMany({
    where: params.where,
    orderBy: routeAssistantJobOrderBy,
    select: routeAssistantJobSelect,
  });
  const records = params.filter ? loaded.filter(params.filter) : loaded;
  const technicians =
    params.technicians ??
    (await findRouteAssistantTechnicians(getRouteAssistantTechnicianIds(records)));
  if (records.length === 0 || technicians.length === 0) {
    return { records, technicians, jobs: [] };
  }

  const coordinatesByPropertyId = await geocodeProperties(
    records.map((record) => record.property)
  );
  const technicianNamesById = new Map(
    technicians.map((technician) => [technician.id, technician.name])
  );
  const jobs = records.map((record) =>
    toRouteAssistantJob(
      record,
      technicianNamesById,
      coordinatesByPropertyId.get(record.property.id) ?? null
    )
  );
  return { records, technicians, jobs };
}
