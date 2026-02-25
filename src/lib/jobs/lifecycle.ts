import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications/create";
import { logAuditEvent } from "@/lib/audit/log";
import {
  getRouteDayRange,
  queueTechDigestItem,
} from "@/lib/notifications/techDigest";
import { formatCustomerName } from "@/lib/customers/format";

type ApplyJobLifecycleUpdateInput = {
  jobId: string;
  data: Prisma.JobUpdateInput;
  actorUserId?: string | null;
};

export async function applyJobLifecycleUpdate({
  jobId,
  data,
  actorUserId,
}: ApplyJobLifecycleUpdateInput) {
  const existing = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      property: true,
    },
  });
  if (!existing) {
    return null;
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data,
    include: {
      customer: true,
      property: true,
      technician: {
        select: {
          id: true,
          userId: true,
          user: { select: { fullName: true } },
        },
      },
    },
  });

  const scheduleChanged =
    updated.scheduledDate.getTime() !== existing.scheduledDate.getTime();
  const technicianChanged = updated.technicianId !== existing.technicianId;
  const sortOrderChanged =
    (updated.sortOrder ?? null) !== (existing.sortOrder ?? null);

  const customerName = formatCustomerName(updated.customer);
  const address = updated.property.address;

  if (technicianChanged && existing.technicianId) {
    await queueTechDigestItem({
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

  if (updated.technicianId && (scheduleChanged || technicianChanged || sortOrderChanged)) {
    const { start, end } = getRouteDayRange(updated.scheduledDate);
    const existingCount = await prisma.job.count({
      where: {
        technicianId: updated.technicianId,
        scheduledDate: { gte: start, lte: end },
        NOT: { id: updated.id },
      },
    });
    await queueTechDigestItem({
      technicianId: updated.technicianId,
      jobId: updated.id,
      routeDate: updated.scheduledDate,
      changeType: scheduleChanged
        ? "JOB_RESCHEDULED"
        : technicianChanged
          ? existingCount === 0
            ? "ROUTE_ASSIGNED"
            : "JOB_ASSIGNED"
          : "ROUTE_REORDERED",
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

  if (updated.technicianId && (technicianChanged || scheduleChanged)) {
    await createNotification({
      customerId: updated.customerId,
      recipientRole: "CUSTOMER",
      eventType: "ROUTE_UPDATED",
      severity: "INFO",
      actorUserId,
      payload: {
        jobId: updated.id,
        technicianId: updated.technicianId,
        scheduledDate: updated.scheduledDate.toISOString(),
      },
    });
  }

  if (scheduleChanged) {
    await createNotification({
      customerId: updated.customerId,
      recipientRole: "CUSTOMER",
      eventType: "SERVICE_RESCHEDULED",
      severity: "WARNING",
      actorUserId,
      payload: {
        jobId: updated.id,
        scheduledDate: updated.scheduledDate.toISOString(),
      },
    });
  }

  if (updated.technician?.userId && (scheduleChanged || technicianChanged || sortOrderChanged)) {
    await createNotification({
      customerId: updated.customerId,
      recipientRole: "TECH",
      recipientUserId: updated.technician.userId,
      eventType: "ROUTE_UPDATED",
      severity: scheduleChanged ? "WARNING" : "INFO",
      actorUserId,
      payload: {
        jobId: updated.id,
        technicianId: updated.technician.id,
        customerName,
        address,
        scheduledDate: updated.scheduledDate.toISOString(),
        changeType: technicianChanged
          ? "ASSIGNED"
          : scheduleChanged
            ? "RESCHEDULED"
            : "REORDERED",
      },
    });
  }

  if (technicianChanged && existing.technicianId) {
    const previousTech = await prisma.technician.findUnique({
      where: { id: existing.technicianId },
      select: { id: true, userId: true },
    });
    if (
      previousTech?.userId &&
      previousTech.userId !== updated.technician?.userId
    ) {
      await createNotification({
        customerId: updated.customerId,
        recipientRole: "TECH",
        recipientUserId: previousTech.userId,
        eventType: "ROUTE_UPDATED",
        severity: "INFO",
        actorUserId,
        payload: {
          jobId: updated.id,
          technicianId: previousTech.id,
          customerName,
          address,
          scheduledDate: existing.scheduledDate.toISOString(),
          changeType: "UNASSIGNED",
        },
      });
    }
  }

  if (actorUserId) {
    const changes: Record<string, unknown> = {};
    if (scheduleChanged) {
      changes.scheduledDate = {
        from: existing.scheduledDate.toISOString(),
        to: updated.scheduledDate.toISOString(),
      };
    }
    if (technicianChanged) {
      changes.technicianId = {
        from: existing.technicianId,
        to: updated.technicianId,
      };
    }
    if (sortOrderChanged) {
      changes.sortOrder = {
        from: existing.sortOrder ?? null,
        to: updated.sortOrder ?? null,
      };
    }
    if (existing.status !== updated.status) {
      changes.status = { from: existing.status, to: updated.status };
    }
    if (existing.priority !== updated.priority) {
      changes.priority = { from: existing.priority, to: updated.priority };
    }
    if (existing.serviceType !== updated.serviceType) {
      changes.serviceType = {
        from: existing.serviceType,
        to: updated.serviceType,
      };
    }
    if ((existing.notes ?? null) !== (updated.notes ?? null)) {
      changes.notesChanged = true;
    }
    if ((existing.customerNotes ?? null) !== (updated.customerNotes ?? null)) {
      changes.customerNotesChanged = true;
    }
    if (Object.keys(changes).length > 0) {
      await logAuditEvent({
        userId: actorUserId,
        action: "JOB_LIFECYCLE_UPDATED",
        entity: "Job",
        entityId: updated.id,
        metadata: {
          customerId: updated.customerId,
          propertyId: updated.propertyId,
          changes,
        },
      });
    }
  }

  return updated;
}
