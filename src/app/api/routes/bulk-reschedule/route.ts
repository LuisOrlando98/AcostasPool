import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRouteDayRange, queueTechDigestItem } from "@/lib/notifications/techDigest";
import { formatCustomerName } from "@/lib/customers/format";
import { createNotification } from "@/lib/notifications/create";

type UpdatePayload = {
  jobId: string;
  scheduledDate?: string;
  sortOrder?: number | null;
  technicianId?: string | null;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  if (updates.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  for (const update of updates as UpdatePayload[]) {
    if (!update.jobId) {
      continue;
    }
    const existing = await prisma.job.findUnique({
      where: { id: update.jobId },
      select: {
        status: true,
        scheduledDate: true,
        technicianId: true,
        customerId: true,
        propertyId: true,
        sortOrder: true,
      },
    });
    if (!existing) {
      continue;
    }

    const nextScheduledDate = update.scheduledDate
      ? new Date(update.scheduledDate)
      : existing.scheduledDate;
    const status =
      existing.status === "COMPLETED"
        ? "COMPLETED"
        : nextScheduledDate > endOfToday
          ? "SCHEDULED"
          : "PENDING";

    const job = await prisma.job.update({
      where: { id: update.jobId },
      data: {
        scheduledDate: nextScheduledDate,
        sortOrder:
          typeof update.sortOrder === "number"
            ? update.sortOrder
            : update.sortOrder === null
              ? null
              : undefined,
        technicianId:
          update.technicianId !== undefined ? update.technicianId : undefined,
        status,
      },
      include: { technician: true, customer: true, property: true },
    });
    const customerName = formatCustomerName(job.customer);

    const technicianChanged =
      update.technicianId !== undefined &&
      update.technicianId !== existing.technicianId;
    const scheduleChanged =
      update.scheduledDate &&
      existing.scheduledDate.toISOString() !== update.scheduledDate;
    const orderChanged =
      typeof update.sortOrder === "number" &&
      update.sortOrder !== existing.sortOrder;

    if (technicianChanged && existing.technicianId) {
      await queueTechDigestItem({
        technicianId: existing.technicianId,
        jobId: job.id,
        routeDate: existing.scheduledDate,
        changeType: "JOB_UNASSIGNED",
        payload: {
          scheduledDate: existing.scheduledDate.toISOString(),
          customerName,
          address: job.property.address,
        },
      });
    }

    if (job.technicianId && (scheduleChanged || technicianChanged || orderChanged)) {
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
        changeType: scheduleChanged
          ? "JOB_RESCHEDULED"
          : technicianChanged
            ? existingCount === 0
              ? "ROUTE_ASSIGNED"
              : "JOB_ASSIGNED"
            : "ROUTE_REORDERED",
        payload: {
          fromScheduledDate: existing.scheduledDate.toISOString(),
          toScheduledDate: job.scheduledDate.toISOString(),
          fromOrder: existing.sortOrder,
          toOrder: job.sortOrder,
          customerName,
          address: job.property.address,
        },
      });
    }

    if (job.technicianId && (technicianChanged || scheduleChanged)) {
      await createNotification({
        customerId: job.customerId,
        recipientRole: "CUSTOMER",
        eventType: "ROUTE_UPDATED",
        severity: "INFO",
        actorUserId: session.sub,
        payload: {
          jobId: job.id,
          technicianId: job.technicianId,
          scheduledDate: job.scheduledDate.toISOString(),
        },
      });
    }

    if (scheduleChanged) {
      await createNotification({
        customerId: job.customerId,
        recipientRole: "CUSTOMER",
        eventType: "SERVICE_RESCHEDULED",
        severity: "WARNING",
        actorUserId: session.sub,
        payload: {
          jobId: job.id,
          scheduledDate: job.scheduledDate.toISOString(),
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
