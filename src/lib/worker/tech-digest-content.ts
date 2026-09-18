import type { Prisma } from "@prisma/client";
import { formatCustomerName } from "@/lib/customers/format";
import { formatDateTimeLabel } from "@/lib/worker/format";
import { asRecord, readDate } from "@/lib/worker/payload";

/** Líneas de los digests de técnicos (mismos textos que el antiguo scripts/cron-worker.cjs). */

export const TECHNICIAN_CONTACT_SELECT = {
  id: true,
  user: { select: { fullName: true, email: true } },
} as const satisfies Prisma.TechnicianSelect;
export type TechnicianContact = Prisma.TechnicianGetPayload<{
  select: typeof TECHNICIAN_CONTACT_SELECT;
}>;

const CUSTOMER_NAME_SELECT = { nombre: true, apellidos: true, email: true } as const;

export const ROUTE_JOB_SELECT = {
  id: true,
  scheduledDate: true,
  customer: { select: CUSTOMER_NAME_SELECT },
  property: { select: { address: true } },
} as const satisfies Prisma.JobSelect;
export type RouteJob = Prisma.JobGetPayload<{ select: typeof ROUTE_JOB_SELECT }>;

export const DIGEST_ITEM_SELECT = {
  id: true,
  changeType: true,
  payload: true,
  job: {
    select: {
      scheduledDate: true,
      customer: { select: CUSTOMER_NAME_SELECT },
      property: { select: { address: true } },
    },
  },
} as const satisfies Prisma.TechDigestItemSelect;
export type DigestItem = Prisma.TechDigestItemGetPayload<{ select: typeof DIGEST_ITEM_SELECT }>;

const PENDING_ADDRESS = "Direccion pendiente";
const PENDING_TIME = "hora pendiente";

export function buildRouteLine(job: RouteJob): string {
  const timeLabel = formatDateTimeLabel(job.scheduledDate);
  return `${timeLabel} - ${formatCustomerName(job.customer)} - ${job.property.address}`;
}

export function buildChangeLine(item: DigestItem): string {
  const customerName = formatCustomerName(item.job.customer);
  const address = item.job.property.address || PENDING_ADDRESS;
  const payload = asRecord(item.payload);
  const fromDate = readDate(payload, "fromScheduledDate");
  const toDate = readDate(payload, "toScheduledDate") ?? item.job.scheduledDate;
  const from = fromDate ? formatDateTimeLabel(fromDate) : null;
  const to = formatDateTimeLabel(toDate);

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
      return `Actualizado: ${customerName} - ${address} (${to || PENDING_TIME})`;
  }
}

/** Agrupa sin mutar: devuelve un nuevo registro por clave. */
export function groupByKey<T>(
  items: readonly T[],
  keyOf: (item: T) => string
): Readonly<Record<string, readonly T[]>> {
  return items.reduce<Readonly<Record<string, readonly T[]>>>((groups, item) => {
    const key = keyOf(item);
    return { ...groups, [key]: [...(groups[key] ?? []), item] };
  }, {});
}
