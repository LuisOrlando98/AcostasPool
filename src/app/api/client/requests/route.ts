import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/create";
import { logAuditEvent } from "@/lib/audit/log";
import {
  getDefaultServiceTierId,
  getServiceTierChecklist,
} from "@/lib/service-tiers";
import { combineDateAndTime } from "@/lib/jobs/scheduling";
import {
  MIN_BOOKING_LEAD_DAYS,
  buildAvailabilityDays,
  getLeadStartDate,
  getWeekStartKey,
  parseDateOnly,
  toDateKey,
  timeValueToMinutes,
} from "@/lib/jobs/capacity";

const requestSchema = z.object({
  propertyId: z.string().min(1),
  reason: z.string().min(3),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  description: z.string().optional(),
  mode: z.enum(["SINGLE", "RECURRING"]).optional(),
  weeks: z.coerce.number().int().min(1).max(12).optional(),
  visitsPerWeek: z.coerce.number().int().min(1).max(2).optional(),
  urgentOverride: z.boolean().optional(),
});

function reserveSlot(
  slotsByDay: Map<string, Array<{ value: string; remaining: number }>>,
  dateKey: string,
  preferredTime?: string
) {
  const slots = slotsByDay.get(dateKey);
  if (!slots || slots.length === 0) {
    return null;
  }

  const tryReserve = (index: number) => {
    if (index < 0 || index >= slots.length) {
      return null;
    }
    const slot = slots[index];
    if (slot.remaining <= 0) {
      return null;
    }
    slot.remaining -= 1;
    return slot.value;
  };

  if (preferredTime) {
    const preferredIndex = slots.findIndex((slot) => slot.value === preferredTime);
    const reservedPreferred = tryReserve(preferredIndex);
    if (reservedPreferred) {
      return reservedPreferred;
    }
  }

  const nextIndex = slots.findIndex((slot) => slot.remaining > 0);
  return tryReserve(nextIndex);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const {
    propertyId,
    reason,
    preferredDate,
    preferredTime,
    description,
    mode: modeRaw,
    weeks: weeksRaw,
    visitsPerWeek: visitsPerWeekRaw,
    urgentOverride = false,
  } =
    parsed.data;
  const mode = modeRaw === "RECURRING" ? "RECURRING" : "SINGLE";
  const weeks = mode === "RECURRING" ? weeksRaw ?? 7 : 1;
  const visitsPerWeek = mode === "RECURRING" ? visitsPerWeekRaw ?? 1 : 1;

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, customerId: true },
  });
  if (!property || property.customerId !== customer.id) {
    return NextResponse.json({ error: "Invalid property" }, { status: 403 });
  }

  const parsedPreferredDate = preferredDate ? parseDateOnly(preferredDate) : null;
  if (preferredDate && !parsedPreferredDate) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const normalizedPreferredTime = preferredTime?.trim() || undefined;
  if (normalizedPreferredTime && timeValueToMinutes(normalizedPreferredTime) == null) {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }

  const leadStartDate = getLeadStartDate(new Date(), MIN_BOOKING_LEAD_DAYS);
  const isUrgentRequest =
    urgentOverride &&
    Boolean(parsedPreferredDate) &&
    parsedPreferredDate.getTime() < leadStartDate.getTime();

  const defaultTierId = await getDefaultServiceTierId();
  const checklist = await getServiceTierChecklist(defaultTierId);

  const baseNotes = `${reason}${description ? ` - ${description}` : ""}`;
  const jobType = mode === "RECURRING" ? "ROUTINE" : "ON_DEMAND";
  const recurringTag =
    mode === "RECURRING"
      ? `\n[Recurring: ${weeks} week(s), ${visitsPerWeek} visit(s)/week]`
      : "";

  let createdJobs: Array<{ id: string; scheduledDate: Date; status: string }> =
    [];
  let partialAutoSchedule = false;

  if (isUrgentRequest) {
    const urgentDate = combineDateAndTime(
      preferredDate ?? toDateKey(leadStartDate),
      normalizedPreferredTime ?? "09:00"
    );
    const urgentSortOrder =
      urgentDate.getHours() * 60 + urgentDate.getMinutes();

    const pendingJob = await prisma.job.create({
      data: {
        customerId: customer.id,
        propertyId,
        scheduledDate: urgentDate,
        sortOrder: urgentSortOrder,
        status: "PENDING",
        type: "ON_DEMAND",
        serviceTierId: defaultTierId,
        checklist,
        notes: `${baseNotes}\n[Urgent request under manual review]`,
        requestedAt: new Date(),
        requestedByUserId: session.sub,
      },
      select: { id: true, scheduledDate: true, status: true },
    });
    createdJobs = [pendingJob];
  } else {
    const preferredStartDate = parsedPreferredDate
      ? new Date(
          Math.max(parsedPreferredDate.getTime(), leadStartDate.getTime())
        )
      : new Date(leadStartDate);
    preferredStartDate.setHours(0, 0, 0, 0);

    const planningDays = Math.max(56, weeks * 18);
    const planningEnd = new Date(preferredStartDate);
    planningEnd.setDate(preferredStartDate.getDate() + planningDays);
    planningEnd.setHours(23, 59, 59, 999);

    const [techniciansCount, existingJobs] = await Promise.all([
      prisma.technician.count({ where: { user: { isActive: true } } }),
      prisma.job.findMany({
        where: {
          scheduledDate: {
            gte: preferredStartDate,
            lte: planningEnd,
          },
        },
        select: { scheduledDate: true },
      }),
    ]);

    const availability = buildAvailabilityDays({
      startDate: preferredStartDate,
      days: planningDays,
      techniciansCount,
      scheduledDates: existingJobs.map((job) => job.scheduledDate),
    });

    const dayKeys = availability
      .filter((day) => day.remainingCapacity > 0)
      .map((day) => day.date);
    const slotsByDay = new Map(
      availability.map((day) => [
        day.date,
        day.slots.map((slot) => ({ ...slot })),
      ])
    );

    if (dayKeys.length === 0) {
      return NextResponse.json(
        { error: "No availability found in the selected range." },
        { status: 409 }
      );
    }

    const preferredDateKey = toDateKey(preferredStartDate);
    const targetVisits = mode === "RECURRING" ? weeks * visitsPerWeek : 1;
    const scheduledDates: Date[] = [];
    const weekCounters = new Map<string, number>();
    let dayIndex =
      dayKeys.findIndex((key) => key >= preferredDateKey) === -1
        ? 0
        : dayKeys.findIndex((key) => key >= preferredDateKey);

    while (scheduledDates.length < targetVisits && dayIndex < dayKeys.length) {
      const dayKey = dayKeys[dayIndex];
      const dayDate = parseDateOnly(dayKey);
      if (!dayDate) {
        dayIndex += 1;
        continue;
      }

      if (mode === "RECURRING") {
        const weekKey = getWeekStartKey(dayDate);
        const alreadyInWeek = weekCounters.get(weekKey) ?? 0;
        if (alreadyInWeek >= visitsPerWeek) {
          dayIndex += 1;
          continue;
        }
      }

      const slotTime = reserveSlot(slotsByDay, dayKey, normalizedPreferredTime);
      if (!slotTime) {
        dayIndex += 1;
        continue;
      }

      const scheduledDate = combineDateAndTime(dayKey, slotTime);
      scheduledDates.push(scheduledDate);

      if (mode === "RECURRING") {
        const weekKey = getWeekStartKey(dayDate);
        weekCounters.set(weekKey, (weekCounters.get(weekKey) ?? 0) + 1);
      }

      if (mode === "SINGLE") {
        break;
      }
      dayIndex += 1;
    }

    if (scheduledDates.length === 0) {
      return NextResponse.json(
        { error: "No availability found for the requested date/time." },
        { status: 409 }
      );
    }

    partialAutoSchedule = scheduledDates.length < targetVisits;
    const now = new Date();
    createdJobs = await prisma.$transaction(
      scheduledDates.map((scheduledDate) => {
        const sortOrder =
          scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
        return prisma.job.create({
          data: {
            customerId: customer.id,
            propertyId,
            scheduledDate,
            sortOrder,
            status: "SCHEDULED",
            type: jobType,
            serviceTierId: defaultTierId,
            checklist,
            notes: `${baseNotes}${recurringTag}`,
            requestedAt: now,
            requestedByUserId: session.sub,
          },
          select: { id: true, scheduledDate: true, status: true },
        });
      })
    );
  }

  await createNotification({
    customerId: customer.id,
    recipientRole: "CUSTOMER",
    eventType: "SERVICE_SCHEDULED",
    severity: "INFO",
    actorUserId: session.sub,
    payload: {
      jobIds: createdJobs.map((job) => job.id),
      count: createdJobs.length,
      mode,
      reviewRequired: isUrgentRequest,
      partial: partialAutoSchedule,
      scheduledDates: createdJobs.map((job) => job.scheduledDate.toISOString()),
    },
  });

  await createNotification({
    customerId: customer.id,
    recipientRole: "ADMIN",
    eventType: "CUSTOMER_REQUEST",
    severity: "WARNING",
    actorUserId: session.sub,
    payload: {
      jobIds: createdJobs.map((job) => job.id),
      count: createdJobs.length,
      requestedAt: new Date().toISOString(),
      preferredDate: preferredDate ?? null,
      preferredTime: normalizedPreferredTime ?? null,
      reason,
      mode,
      weeks: mode === "RECURRING" ? weeks : 1,
      visitsPerWeek: mode === "RECURRING" ? visitsPerWeek : 1,
      reviewRequired: isUrgentRequest,
      partial: partialAutoSchedule,
    },
  });

  await logAuditEvent({
    userId: session.sub,
    action: "CUSTOMER_REQUEST_CREATED",
    entity: "Job",
    metadata: {
      customerId: customer.id,
      propertyId,
      jobIds: createdJobs.map((job) => job.id),
      mode,
      reviewRequired: isUrgentRequest,
      partial: partialAutoSchedule,
      reason,
      preferredDate: preferredDate ?? null,
      preferredTime: normalizedPreferredTime ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    reviewRequired: isUrgentRequest,
    partial: partialAutoSchedule,
    createdCount: createdJobs.length,
    jobIds: createdJobs.map((job) => job.id),
  });
}
