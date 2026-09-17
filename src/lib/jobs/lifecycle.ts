import type { NotificationSeverity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createNotification,
  type CreateNotificationInput,
  type DeferredNotification,
} from "@/lib/notifications/create";
import { logAuditEvent } from "@/lib/audit/log";
import {
  getRouteDayRange,
  queueTechDigestItem,
} from "@/lib/notifications/techDigest";
import { formatCustomerName } from "@/lib/customers/format";

/**
 * Ciclo de vida de un job (reprogramación, cambio de técnico, reorden, estado, notas...).
 *
 * `applyJobLifecycleUpdate` ejecuta en UNA transacción: la actualización del job, los items del
 * digest de técnicos, las notificaciones (creadas con `tx`) y la auditoría. La publicación en
 * tiempo real se hace después del commit y nunca hace fallar la operación.
 *
 * `preloaded`: snapshot previo del job ya cargado por el llamante con
 * `JOB_LIFECYCLE_SNAPSHOT_SELECT` (evita una segunda lectura en lotes). Si se omite, el job se lee
 * dentro de la transacción.
 */

export const JOB_LIFECYCLE_SNAPSHOT_SELECT = {
  id: true,
  scheduledDate: true,
  technicianId: true,
  sortOrder: true,
  status: true,
  priority: true,
  serviceType: true,
  notes: true,
  customerNotes: true,
} satisfies Prisma.JobSelect;

export type JobLifecycleSnapshot = Prisma.JobGetPayload<{
  select: typeof JOB_LIFECYCLE_SNAPSHOT_SELECT;
}>;

const UPDATED_JOB_INCLUDE = {
  customer: true,
  property: true,
  technician: {
    select: {
      id: true,
      userId: true,
      user: { select: { fullName: true } },
    },
  },
} satisfies Prisma.JobInclude;

export type UpdatedLifecycleJob = Prisma.JobGetPayload<{
  include: typeof UPDATED_JOB_INCLUDE;
}>;

type ApplyJobLifecycleUpdateInput = {
  jobId: string;
  data: Prisma.JobUpdateInput;
  actorUserId?: string | null;
  preloaded?: JobLifecycleSnapshot | null;
};

type JobChanges = {
  scheduleChanged: boolean;
  technicianChanged: boolean;
  sortOrderChanged: boolean;
  /** Alguno de los tres anteriores. */
  routeChanged: boolean;
};

type LifecycleContext = {
  tx: Prisma.TransactionClient;
  existing: JobLifecycleSnapshot;
  updated: UpdatedLifecycleJob;
  changes: JobChanges;
  customerName: string;
  address: string;
  actorUserId: string | null;
};

type PreviousTechnician = { id: string; userId: string };

type LifecycleResult = {
  updated: UpdatedLifecycleJob;
  notifications: DeferredNotification[];
};

const AUDIT_ACTION = "JOB_LIFECYCLE_UPDATED";
const ROUTE_UPDATED_EVENT = "ROUTE_UPDATED";

function detectJobChanges(
  existing: JobLifecycleSnapshot,
  updated: UpdatedLifecycleJob
): JobChanges {
  const scheduleChanged =
    updated.scheduledDate.getTime() !== existing.scheduledDate.getTime();
  const technicianChanged = updated.technicianId !== existing.technicianId;
  const sortOrderChanged =
    (updated.sortOrder ?? null) !== (existing.sortOrder ?? null);
  return {
    scheduleChanged,
    technicianChanged,
    sortOrderChanged,
    routeChanged: scheduleChanged || technicianChanged || sortOrderChanged,
  };
}

function resolveDigestChangeType(changes: JobChanges, otherJobsOnRoute: number) {
  if (changes.scheduleChanged) {
    return "JOB_RESCHEDULED";
  }
  if (changes.technicianChanged) {
    return otherJobsOnRoute === 0 ? "ROUTE_ASSIGNED" : "JOB_ASSIGNED";
  }
  return "ROUTE_REORDERED";
}

function resolveTechChangeType(changes: JobChanges) {
  if (changes.technicianChanged) {
    return "ASSIGNED";
  }
  if (changes.scheduleChanged) {
    return "RESCHEDULED";
  }
  return "REORDERED";
}

async function queueDigestItems(context: LifecycleContext) {
  const { tx, existing, updated, changes, customerName, address } = context;

  if (changes.technicianChanged && existing.technicianId) {
    await queueTechDigestItem({
      tx,
      technicianId: existing.technicianId,
      jobId: updated.id,
      routeDate: existing.scheduledDate,
      changeType: "JOB_UNASSIGNED",
      payload: {
        scheduledDate: existing.scheduledDate.toISOString(),
        customerName,
        address,
      },
    });
  }

  if (!updated.technicianId || !changes.routeChanged) {
    return;
  }

  const { start, end } = getRouteDayRange(updated.scheduledDate);
  const otherJobsOnRoute = await tx.job.count({
    where: {
      technicianId: updated.technicianId,
      scheduledDate: { gte: start, lte: end },
      NOT: { id: updated.id },
    },
  });
  await queueTechDigestItem({
    tx,
    technicianId: updated.technicianId,
    jobId: updated.id,
    routeDate: updated.scheduledDate,
    changeType: resolveDigestChangeType(changes, otherJobsOnRoute),
    payload: {
      fromScheduledDate: existing.scheduledDate.toISOString(),
      toScheduledDate: updated.scheduledDate.toISOString(),
      fromOrder: existing.sortOrder,
      toOrder: updated.sortOrder,
      customerName,
      address,
    },
  });
}

function buildCustomerNotificationSpecs(
  context: LifecycleContext
): CreateNotificationInput[] {
  const { updated, changes, actorUserId } = context;
  const scheduledDate = updated.scheduledDate.toISOString();
  const base = {
    customerId: updated.customerId,
    recipientRole: "CUSTOMER" as const,
    actorUserId,
  };
  const routeUpdated =
    updated.technicianId && (changes.technicianChanged || changes.scheduleChanged)
      ? [
          {
            ...base,
            eventType: ROUTE_UPDATED_EVENT,
            severity: "INFO" as const,
            payload: {
              jobId: updated.id,
              technicianId: updated.technicianId,
              scheduledDate,
            },
          },
        ]
      : [];
  const rescheduled = changes.scheduleChanged
    ? [
        {
          ...base,
          eventType: "SERVICE_RESCHEDULED",
          severity: "WARNING" as const,
          payload: { jobId: updated.id, scheduledDate },
        },
      ]
    : [];
  return [...routeUpdated, ...rescheduled];
}

function buildTechNotificationSpecs(
  context: LifecycleContext,
  previousTechnician: PreviousTechnician | null
): CreateNotificationInput[] {
  const { existing, updated, changes, customerName, address, actorUserId } =
    context;
  const base = {
    customerId: updated.customerId,
    recipientRole: "TECH" as const,
    eventType: ROUTE_UPDATED_EVENT,
    actorUserId,
  };
  const currentSeverity: NotificationSeverity = changes.scheduleChanged
    ? "WARNING"
    : "INFO";
  const current =
    updated.technician?.userId && changes.routeChanged
      ? [
          {
            ...base,
            recipientUserId: updated.technician.userId,
            severity: currentSeverity,
            payload: {
              jobId: updated.id,
              technicianId: updated.technician.id,
              customerName,
              address,
              scheduledDate: updated.scheduledDate.toISOString(),
              changeType: resolveTechChangeType(changes),
            },
          },
        ]
      : [];
  const previous = previousTechnician
    ? [
        {
          ...base,
          recipientUserId: previousTechnician.userId,
          severity: "INFO" as const,
          payload: {
            jobId: updated.id,
            technicianId: previousTechnician.id,
            customerName,
            address,
            scheduledDate: existing.scheduledDate.toISOString(),
            changeType: "UNASSIGNED",
          },
        },
      ]
    : [];
  return [...current, ...previous];
}

async function findPreviousTechnician(
  context: LifecycleContext
): Promise<PreviousTechnician | null> {
  const { tx, existing, updated, changes } = context;
  if (!changes.technicianChanged || !existing.technicianId) {
    return null;
  }
  const previous = await tx.technician.findUnique({
    where: { id: existing.technicianId },
    select: { id: true, userId: true },
  });
  if (!previous?.userId || previous.userId === updated.technician?.userId) {
    return null;
  }
  return { id: previous.id, userId: previous.userId };
}

async function createLifecycleNotifications(
  context: LifecycleContext
): Promise<DeferredNotification[]> {
  const previousTechnician = await findPreviousTechnician(context);
  const specs = [
    ...buildCustomerNotificationSpecs(context),
    ...buildTechNotificationSpecs(context, previousTechnician),
  ];
  let created: DeferredNotification[] = [];
  for (const spec of specs) {
    created = [...created, await createNotification({ ...spec, tx: context.tx })];
  }
  return created;
}

function buildAuditChanges(
  existing: JobLifecycleSnapshot,
  updated: UpdatedLifecycleJob,
  changes: JobChanges
): Record<string, unknown> {
  return {
    ...(changes.scheduleChanged
      ? {
          scheduledDate: {
            from: existing.scheduledDate.toISOString(),
            to: updated.scheduledDate.toISOString(),
          },
        }
      : {}),
    ...(changes.technicianChanged
      ? { technicianId: { from: existing.technicianId, to: updated.technicianId } }
      : {}),
    ...(changes.sortOrderChanged
      ? {
          sortOrder: {
            from: existing.sortOrder ?? null,
            to: updated.sortOrder ?? null,
          },
        }
      : {}),
    ...(existing.status !== updated.status
      ? { status: { from: existing.status, to: updated.status } }
      : {}),
    ...(existing.priority !== updated.priority
      ? { priority: { from: existing.priority, to: updated.priority } }
      : {}),
    ...(existing.serviceType !== updated.serviceType
      ? { serviceType: { from: existing.serviceType, to: updated.serviceType } }
      : {}),
    ...((existing.notes ?? null) !== (updated.notes ?? null)
      ? { notesChanged: true }
      : {}),
    ...((existing.customerNotes ?? null) !== (updated.customerNotes ?? null)
      ? { customerNotesChanged: true }
      : {}),
  };
}

async function logLifecycleAudit(context: LifecycleContext) {
  const { tx, existing, updated, changes, actorUserId } = context;
  if (!actorUserId) {
    return;
  }
  const auditChanges = buildAuditChanges(existing, updated, changes);
  if (Object.keys(auditChanges).length === 0) {
    return;
  }
  await logAuditEvent({
    tx,
    userId: actorUserId,
    action: AUDIT_ACTION,
    entity: "Job",
    entityId: updated.id,
    metadata: {
      customerId: updated.customerId,
      propertyId: updated.propertyId,
      changes: auditChanges,
    },
  });
}

async function runLifecycleTransaction(
  tx: Prisma.TransactionClient,
  { jobId, data, actorUserId, preloaded }: ApplyJobLifecycleUpdateInput
): Promise<LifecycleResult | null> {
  const existing =
    preloaded ??
    (await tx.job.findUnique({
      where: { id: jobId },
      select: JOB_LIFECYCLE_SNAPSHOT_SELECT,
    }));
  if (!existing) {
    return null;
  }

  const updated = await tx.job.update({
    where: { id: jobId },
    data,
    include: UPDATED_JOB_INCLUDE,
  });

  const context: LifecycleContext = {
    tx,
    existing,
    updated,
    changes: detectJobChanges(existing, updated),
    customerName: formatCustomerName(updated.customer),
    address: updated.property.address,
    actorUserId: actorUserId ?? null,
  };

  await queueDigestItems(context);
  const notifications = await createLifecycleNotifications(context);
  await logLifecycleAudit(context);
  return { updated, notifications };
}

export async function applyJobLifecycleUpdate(
  input: ApplyJobLifecycleUpdateInput
): Promise<UpdatedLifecycleJob | null> {
  if (input.preloaded && input.preloaded.id !== input.jobId) {
    throw new Error(
      `Preloaded job ${input.preloaded.id} does not match jobId ${input.jobId}`
    );
  }

  const result = await prisma.$transaction((tx) =>
    runLifecycleTransaction(tx, input)
  );
  if (!result) {
    return null;
  }

  // Tiempo real solo tras el commit; cada publish() aísla sus propios fallos.
  await Promise.all(result.notifications.map((item) => item.publish()));
  return result.updated;
}
