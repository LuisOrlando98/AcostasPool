import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { combineDateAndTime } from "@/lib/jobs/scheduling";
import {
  getDefaultServiceTierId,
  getServiceTierChecklist,
} from "@/lib/service-tiers";
import { getRouteDayRange, queueTechDigestItem } from "@/lib/notifications/techDigest";
import { formatCustomerName } from "@/lib/customers/format";
import { createNotification } from "@/lib/notifications/create";
import { logAuditEvent } from "@/lib/audit/log";
import { endOfBusinessDay, getBusinessTimeParts } from "@/lib/timezone";

type DraftPayload = {
  customerId: string;
  propertyId: string;
  technicianId?: string;
  scheduledTime?: string;
  serviceTierId?: string;
  serviceType?: string;
  priority?: string;
  type?: string;
  estimatedDurationMinutes?: number | null;
  notes?: string;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const date = String(body?.date ?? "");
  const drafts = Array.isArray(body?.jobs) ? body.jobs : [];

  if (!date || drafts.length === 0) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const propertyIds = [
    ...new Set(
      drafts
        .map((draft: DraftPayload) => draft.propertyId)
        .filter((value): value is string => typeof value === "string" && value)
    ),
  ];
  const properties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: { id: true, customerId: true },
  });
  const propertyCustomerById = new Map(
    properties.map((property) => [property.id, property.customerId])
  );

  const endOfToday = endOfBusinessDay(new Date()) ?? new Date();

  const created: Array<{
    id: string;
    scheduledDate: string;
    status: string;
    type: string;
    priority: string;
    serviceTierId: string | null;
    serviceType: string;
    estimatedDurationMinutes: number | null;
    technicianId: string | null;
    sortOrder?: number | null;
    notes?: string | null;
    checklist?: { label?: string; completed?: boolean }[] | null;
    customer: {
      id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
    };
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
  }> = [];

  for (const draft of drafts as DraftPayload[]) {
    if (!draft.customerId || !draft.propertyId) {
      continue;
    }
    const propertyCustomerId = propertyCustomerById.get(draft.propertyId);
    if (!propertyCustomerId || propertyCustomerId !== draft.customerId) {
      return NextResponse.json(
        { error: `Invalid property for customer in draft: ${draft.propertyId}` },
        { status: 400 }
      );
    }
    const scheduledDate = combineDateAndTime(
      date,
      draft.scheduledTime || "09:00"
    );
    const timeParts = getBusinessTimeParts(scheduledDate);
    const sortOrder = (timeParts?.hour ?? 0) * 60 + (timeParts?.minute ?? 0);
    const status = scheduledDate > endOfToday ? "SCHEDULED" : "PENDING";
    const serviceType =
      draft.serviceType === "FILTER_CHECK" ||
      draft.serviceType === "CHEM_BALANCE" ||
      draft.serviceType === "EQUIPMENT_CHECK"
        ? draft.serviceType
        : "WEEKLY_CLEANING";
    const serviceTierId =
      draft.serviceTierId?.trim() || (await getDefaultServiceTierId());
    const priority = draft.priority === "URGENT" ? "URGENT" : "NORMAL";
    const type = draft.type === "ON_DEMAND" ? "ON_DEMAND" : "ROUTINE";
    const checklist = await getServiceTierChecklist(serviceTierId);

    const job = await prisma.job.create({
      data: {
        customerId: draft.customerId,
        propertyId: draft.propertyId,
        technicianId: draft.technicianId || null,
        scheduledDate,
        sortOrder,
        status,
        type,
        priority,
        serviceTierId,
        serviceType,
        estimatedDurationMinutes:
          typeof draft.estimatedDurationMinutes === "number"
            ? draft.estimatedDurationMinutes
            : null,
        notes: draft.notes || null,
        checklist,
      },
      include: {
        customer: true,
        property: true,
        technician: { include: { user: true } },
      },
    });
    const customerName = formatCustomerName(job.customer);

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
          customerName,
          address: job.property.address,
        },
      });
    }

    await createNotification({
      customerId: job.customerId,
      recipientRole: "CUSTOMER",
      eventType: "SERVICE_SCHEDULED",
      severity: "INFO",
      actorUserId: session.sub,
      payload: {
        jobId: job.id,
        technicianId: job.technicianId,
        scheduledDate: job.scheduledDate.toISOString(),
      },
    });

    if (job.technician?.userId) {
      await createNotification({
        customerId: job.customerId,
        recipientRole: "TECH",
        recipientUserId: job.technician.userId,
        eventType: "ROUTE_UPDATED",
        severity: "INFO",
        actorUserId: session.sub,
        payload: {
          jobId: job.id,
          technicianId: job.technician.id,
          customerName,
          address: job.property.address,
          scheduledDate: job.scheduledDate.toISOString(),
          changeType: "ASSIGNED",
        },
      });
    }

    created.push({
      id: job.id,
      scheduledDate: job.scheduledDate.toISOString(),
      status: job.status,
      type: job.type,
      priority: job.priority,
      serviceTierId: job.serviceTierId ?? null,
      serviceType: job.serviceType,
      estimatedDurationMinutes: job.estimatedDurationMinutes,
      technicianId: job.technicianId,
      sortOrder: job.sortOrder,
      notes: job.notes ?? null,
      checklist: Array.isArray(job.checklist)
        ? (job.checklist as Array<{ label?: string; completed?: boolean }>)
        : null,
      customer: {
        id: job.customer.id,
        name: customerName,
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
    });
  }

  if (created.length > 0) {
    await logAuditEvent({
      userId: session.sub,
      action: "JOBS_BULK_CREATED",
      entity: "Job",
      metadata: {
        count: created.length,
        jobIds: created.map((item) => item.id),
        date,
      },
    });
  }

  return NextResponse.json({ jobs: created });
}
