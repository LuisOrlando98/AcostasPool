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
import { addPlanFrequency, combineDateAndTime } from "@/lib/jobs/scheduling";
import { CUSTOM_SERVICE_PLAN_NAME } from "@/lib/jobs/recurring-plan-templates";
import {
  MIN_BOOKING_LEAD_DAYS,
  buildAvailabilityDays,
  getLeadStartDate,
  parseDateOnly,
  toDateKey,
  timeValueToMinutes,
} from "@/lib/jobs/capacity";
import {
  addBusinessDays,
  endOfBusinessDay,
  getBusinessTimeParts,
  startOfBusinessDay,
} from "@/lib/timezone";

const requestSchema = z.object({
  propertyId: z.string().min(1),
  reason: z.string().min(3),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  description: z.string().optional(),
  mode: z.enum(["SINGLE", "RECURRING"]).optional(),
  visitsPerWeek: z.coerce.number().int().min(1).max(5).optional(),
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
    visitsPerWeek: visitsPerWeekRaw,
    urgentOverride = false,
  } = parsed.data;

  const mode = modeRaw === "RECURRING" ? "RECURRING" : "SINGLE";

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: {
      id: true,
      allowWeekendBooking: true,
      tipoCliente: true,
      estadoCuenta: true,
      pauseServicesFrom: true,
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  if (customer.estadoCuenta !== "ACTIVE") {
    return NextResponse.json(
      { error: "Account is inactive. Contact support." },
      { status: 403 }
    );
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, customerId: true },
  });
  if (!property || property.customerId !== customer.id) {
    return NextResponse.json({ error: "Invalid property" }, { status: 403 });
  }

  const visitsCap = customer.tipoCliente === "COMMERCIAL" ? 5 : 2;
  const visitsPerWeek = mode === "RECURRING" ? visitsPerWeekRaw ?? 1 : 1;
  if (mode === "RECURRING" && visitsPerWeek > visitsCap) {
    return NextResponse.json(
      {
        error:
          customer.tipoCliente === "COMMERCIAL"
            ? "Commercial accounts support up to 5 visits per week."
            : "Residential accounts support up to 2 visits per week.",
      },
      { status: 400 }
    );
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
    mode === "SINGLE" &&
    urgentOverride &&
    Boolean(parsedPreferredDate) &&
    parsedPreferredDate.getTime() < leadStartDate.getTime();

  const defaultTierId = await getDefaultServiceTierId();
  const checklist = await getServiceTierChecklist(defaultTierId);
  const baseNotes = `${reason}${description ? ` - ${description}` : ""}`;

  let createdJobs: Array<{ id: string; scheduledDate: Date; status: string }> = [];
  let createdPlanIds: string[] = [];
  const partialAutoSchedule = false;

  if (isUrgentRequest) {
    const urgentDate = combineDateAndTime(
      preferredDate ?? toDateKey(leadStartDate),
      normalizedPreferredTime ?? "09:00"
    );
    const urgentTimeParts = getBusinessTimeParts(urgentDate);
    const urgentSortOrder =
      (urgentTimeParts?.hour ?? 0) * 60 + (urgentTimeParts?.minute ?? 0);

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
    const preferredStartDateBase = parsedPreferredDate
      ? new Date(Math.max(parsedPreferredDate.getTime(), leadStartDate.getTime()))
      : new Date(leadStartDate);
    const preferredStartDate =
      startOfBusinessDay(preferredStartDateBase) ?? preferredStartDateBase;

    const planningDays = mode === "RECURRING" ? 140 : 56;
    const planningEnd =
      endOfBusinessDay(
        addBusinessDays(preferredStartDate, planningDays) ?? preferredStartDate
      ) ?? preferredStartDate;

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
      includeSaturday: customer.allowWeekendBooking,
      includeSunday: customer.allowWeekendBooking,
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
    const startIndex = Math.max(0, dayKeys.findIndex((key) => key >= preferredDateKey));

    if (mode === "SINGLE") {
      let reservedDate: Date | null = null;
      for (let dayIndex = startIndex; dayIndex < dayKeys.length; dayIndex += 1) {
        const dayKey = dayKeys[dayIndex];
        const slotTime = reserveSlot(slotsByDay, dayKey, normalizedPreferredTime);
        if (!slotTime) {
          continue;
        }
        reservedDate = combineDateAndTime(dayKey, slotTime);
        break;
      }

      if (!reservedDate) {
        return NextResponse.json(
          { error: "No availability found for the requested date/time." },
          { status: 409 }
        );
      }

      const now = new Date();
      createdJobs = await prisma.$transaction([
        prisma.job.create({
          data: {
            customerId: customer.id,
            propertyId,
            scheduledDate: reservedDate,
            sortOrder:
              ((getBusinessTimeParts(reservedDate)?.hour ?? 0) * 60) +
              (getBusinessTimeParts(reservedDate)?.minute ?? 0),
            status: reservedDate > (endOfBusinessDay(now) ?? now) ? "SCHEDULED" : "PENDING",
            type: "ON_DEMAND",
            serviceTierId: defaultTierId,
            checklist,
            notes: baseNotes,
            requestedAt: now,
            requestedByUserId: session.sub,
          },
          select: { id: true, scheduledDate: true, status: true },
        }),
      ]);
    } else {
      if (customer.pauseServicesFrom) {
        return NextResponse.json(
          {
            error:
              "Recurring services are currently paused. Resume services from your profile before creating a recurring request.",
          },
          { status: 409 }
        );
      }

      const weeklyAnchors: Array<{ dayKey: string; slotTime: string; scheduledDate: Date }> = [];
      const pickedWeekdays = new Set<number>();

      for (
        let dayIndex = startIndex;
        dayIndex < dayKeys.length && weeklyAnchors.length < visitsPerWeek;
        dayIndex += 1
      ) {
        const dayKey = dayKeys[dayIndex];
        const dayDate = parseDateOnly(dayKey);
        if (!dayDate) {
          continue;
        }
        const weekDay = dayDate.getUTCDay();
        if (pickedWeekdays.has(weekDay)) {
          continue;
        }

        const slotTime = reserveSlot(slotsByDay, dayKey, normalizedPreferredTime);
        if (!slotTime) {
          continue;
        }

        const scheduledDate = combineDateAndTime(dayKey, slotTime);
        if (Number.isNaN(scheduledDate.getTime())) {
          continue;
        }

        weeklyAnchors.push({ dayKey, slotTime, scheduledDate });
        pickedWeekdays.add(weekDay);
      }

      if (weeklyAnchors.length < visitsPerWeek) {
        return NextResponse.json(
          {
            error:
              "Not enough availability to lock the requested recurring frequency. Try another start date or time.",
          },
          { status: 409 }
        );
      }

      const now = new Date();
      const endOfToday = endOfBusinessDay(now) ?? now;
      const created = await prisma.$transaction(async (tx) => {
        const planIds: string[] = [];
        const jobs: Array<{ id: string; scheduledDate: Date; status: string }> = [];

        for (let index = 0; index < weeklyAnchors.length; index += 1) {
          const anchor = weeklyAnchors[index];
          const sortOrder =
            ((getBusinessTimeParts(anchor.scheduledDate)?.hour ?? 0) * 60) +
            (getBusinessTimeParts(anchor.scheduledDate)?.minute ?? 0);

          const plan = await tx.servicePlan.create({
            data: {
              customerId: customer.id,
              propertyId,
              name: CUSTOM_SERVICE_PLAN_NAME,
              frequency: "WEEKLY",
              serviceType: "WEEKLY_CLEANING",
              priority: "NORMAL",
              serviceTierId: defaultTierId,
              nextRunAt: anchor.scheduledDate,
              preferredTime: anchor.slotTime,
              checklist,
              notes: `${baseNotes}\n[Auto recurring plan from customer request]`,
              isActive: true,
            },
            select: {
              id: true,
              customerId: true,
              propertyId: true,
              serviceType: true,
              priority: true,
              serviceTierId: true,
              estimatedDurationMinutes: true,
              nextRunAt: true,
            },
          });

          const firstJob = await tx.job.create({
            data: {
              customerId: plan.customerId,
              propertyId: plan.propertyId,
              scheduledDate: plan.nextRunAt,
              sortOrder,
              status: plan.nextRunAt > endOfToday ? "SCHEDULED" : "PENDING",
              type: "ROUTINE",
              priority: plan.priority,
              serviceTierId: plan.serviceTierId,
              serviceType: plan.serviceType,
              estimatedDurationMinutes: plan.estimatedDurationMinutes,
              checklist,
              notes: `${baseNotes}\n[Recurring schedule]`,
              planId: plan.id,
              requestedAt: now,
              requestedByUserId: session.sub,
            },
            select: { id: true, scheduledDate: true, status: true },
          });

          await tx.servicePlan.update({
            where: { id: plan.id },
            data: { nextRunAt: addPlanFrequency(plan.nextRunAt, "WEEKLY") },
          });

          planIds.push(plan.id);
          jobs.push(firstJob);
        }

        return { planIds, jobs };
      });

      createdPlanIds = created.planIds;
      createdJobs = created.jobs;
    }
  }

  if (createdJobs.length > 0) {
    for (const job of createdJobs) {
      await createNotification({
        customerId: customer.id,
        recipientRole: "CUSTOMER",
        eventType: "SERVICE_SCHEDULED",
        severity: "INFO",
        actorUserId: session.sub,
        payload: {
          jobId: job.id,
          mode,
          recurringPlanIds: createdPlanIds,
          reviewRequired: isUrgentRequest,
          partial: partialAutoSchedule,
        },
      });
    }
  }

  await createNotification({
    customerId: customer.id,
    recipientRole: "ADMIN",
    eventType: "CUSTOMER_REQUEST",
    severity: "WARNING",
    actorUserId: session.sub,
    payload: {
      jobIds: createdJobs.map((job) => job.id),
      planIds: createdPlanIds,
      count: createdJobs.length,
      requestedAt: new Date().toISOString(),
      preferredDate: preferredDate ?? null,
      preferredTime: normalizedPreferredTime ?? null,
      reason,
      mode,
      visitsPerWeek: mode === "RECURRING" ? visitsPerWeek : 1,
      reviewRequired: isUrgentRequest,
      partial: partialAutoSchedule,
    },
  });

  await logAuditEvent({
    userId: session.sub,
    action: "CUSTOMER_REQUEST_CREATED",
    entity: mode === "RECURRING" ? "ServicePlan" : "Job",
    metadata: {
      customerId: customer.id,
      propertyId,
      jobIds: createdJobs.map((job) => job.id),
      planIds: createdPlanIds,
      mode,
      reviewRequired: isUrgentRequest,
      partial: partialAutoSchedule,
      reason,
      preferredDate: preferredDate ?? null,
      preferredTime: normalizedPreferredTime ?? null,
      visitsPerWeek: mode === "RECURRING" ? visitsPerWeek : 1,
    },
  });

  return NextResponse.json({
    ok: true,
    reviewRequired: isUrgentRequest,
    partial: partialAutoSchedule,
    mode,
    createdCount: createdJobs.length,
    createdPlanCount: createdPlanIds.length,
    jobIds: createdJobs.map((job) => job.id),
    planIds: createdPlanIds,
  });
}
