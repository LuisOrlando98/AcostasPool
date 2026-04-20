import { NextResponse } from "next/server";
import { z } from "zod";
import type { JobStatus } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";
import { parseDateOnly } from "@/lib/jobs/capacity";
import { applyJobLifecycleUpdate } from "@/lib/jobs/lifecycle";
import {
  buildRecurringRouteGroupId,
  buildRecurringRouteGroupLabel,
  getGlobalRecurringPlanByWeekday,
  isGlobalRecurringPlanName,
} from "@/lib/jobs/recurring-plan-templates";
import {
  buildRouteAssistantPlans,
  DEFAULT_ROUTE_ORIGIN_ADDRESS,
} from "@/lib/routing/planner";
import { geocodeAddresses } from "@/lib/routing/geo";
import {
  BUSINESS_TIMEZONE,
  endOfBusinessDay,
  startOfBusinessDay,
} from "@/lib/timezone";
import { getRouteAssistantConfig } from "@/lib/site-settings";

const statusValues = ["SCHEDULED", "PENDING", "ON_THE_WAY", "IN_PROGRESS"] as const;

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function hasValidCronSecret(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return false;
  }
  const received = request.headers.get("x-cron-secret")?.trim();
  return received === expected;
}

export async function POST(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const config = await getRouteAssistantConfig();
  if (!config.dailyAutoOptimizeEnabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "disabled" });
  }

  const routeDateKey =
    parsed.data.date ??
    DateTime.now().setZone(BUSINESS_TIMEZONE).toFormat("yyyy-MM-dd");
  const routeDate = parseDateOnly(routeDateKey);
  if (!routeDate) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const weekday = DateTime.fromISO(routeDateKey, {
    zone: BUSINESS_TIMEZONE,
  }).weekday;
  const recurringPlan = getGlobalRecurringPlanByWeekday(weekday);
  if (!recurringPlan) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "no-plan-for-day",
      date: routeDateKey,
    });
  }

  const dayStart = startOfBusinessDay(routeDate) ?? routeDate;
  const dayEnd = endOfBusinessDay(routeDate) ?? routeDate;

  const jobs = await prisma.job.findMany({
    where: {
      status: { in: [...statusValues] as JobStatus[] },
      scheduledDate: { gte: dayStart, lte: dayEnd },
      plan: {
        is: {
          name: recurringPlan.name,
        },
      },
    },
    orderBy: [{ scheduledDate: "asc" }, { sortOrder: "asc" }],
    select: {
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
          address: true,
        },
      },
      plan: {
        select: {
          id: true,
          name: true,
          technicianId: true,
        },
      },
    },
  });

  if (jobs.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "no-jobs",
      date: routeDateKey,
      planName: recurringPlan.name,
    });
  }

  const technicianIdsInScope = Array.from(
    new Set(
      jobs
        .map((job) => job.plan?.technicianId ?? job.technicianId ?? null)
        .filter((value): value is string => Boolean(value))
    )
  );

  if (technicianIdsInScope.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "no-technicians",
      date: routeDateKey,
      planName: recurringPlan.name,
    });
  }

  const technicians = await prisma.technician.findMany({
    where: {
      id: { in: technicianIdsInScope },
      user: { isActive: true },
    },
    orderBy: { user: { fullName: "asc" } },
    select: {
      id: true,
      user: { select: { fullName: true } },
    },
  });

  const techniciansData = technicians.map((technician) => ({
    id: technician.id,
    name: technician.user.fullName,
  }));
  if (techniciansData.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "no-active-technicians",
      date: routeDateKey,
      planName: recurringPlan.name,
    });
  }

  const geocoded = await geocodeAddresses([
    DEFAULT_ROUTE_ORIGIN_ADDRESS,
    ...jobs.map((job) => job.property.address),
  ]);
  const originCoordinates = geocoded.get(DEFAULT_ROUTE_ORIGIN_ADDRESS) ?? null;

  const plannedJobs = jobs.map((job) => ({
    id: job.id,
    customerName: formatCustomerName(job.customer),
    address: job.property.address,
    technicianId: job.technicianId,
    planName: job.plan?.name ?? null,
    routeGroupId: job.plan?.name
      ? buildRecurringRouteGroupId({
          planName: job.plan.name,
          technicianId: job.plan.technicianId ?? job.technicianId,
        })
      : null,
    routeGroupLabel: job.plan?.name
      ? buildRecurringRouteGroupLabel({
          planName: job.plan.name,
          technicianName:
            techniciansData.find(
              (technician) =>
                technician.id === (job.plan?.technicianId ?? job.technicianId)
            )?.name ?? null,
        })
      : null,
    lockedTechnicianId:
      job.plan?.name && isGlobalRecurringPlanName(job.plan.name)
        ? (job.plan.technicianId ?? job.technicianId ?? null)
        : null,
    scheduledDate: job.scheduledDate,
    estimatedDurationMinutes: job.estimatedDurationMinutes,
    coordinates: geocoded.get(job.property.address) ?? null,
  }));

  const plans = await buildRouteAssistantPlans({
    jobs: plannedJobs,
    technicians: techniciansData,
    originAddress: DEFAULT_ROUTE_ORIGIN_ADDRESS,
    originCoordinates,
    strategies: ["KEEP_ASSIGNMENTS"],
  });
  const selectedPlan = plans[0];

  if (!selectedPlan || selectedPlan.updates.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "no-updates",
      date: routeDateKey,
      planName: recurringPlan.name,
    });
  }

  for (const update of selectedPlan.updates) {
    await applyJobLifecycleUpdate({
      jobId: update.jobId,
      actorUserId: null,
      data: {
        sortOrder: update.sortOrder,
        technician: update.technicianId
          ? { connect: { id: update.technicianId } }
          : undefined,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    date: routeDateKey,
    planName: recurringPlan.name,
    technicians: techniciansData.length,
    jobsCount: plannedJobs.length,
    appliedUpdates: selectedPlan.updates.length,
    unresolvedGeocodes: plannedJobs.filter((job) => !job.coordinates).length,
    summary: selectedPlan.summary,
  });
}
