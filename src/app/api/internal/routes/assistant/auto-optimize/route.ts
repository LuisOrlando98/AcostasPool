import { NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { parseDateOnly } from "@/lib/jobs/capacity";
import { applyJobLifecycleUpdate } from "@/lib/jobs/lifecycle";
import { getGlobalRecurringPlanByWeekday } from "@/lib/jobs/recurring-plan-templates";
import {
  buildRouteAssistantPlans,
  DEFAULT_ROUTE_ORIGIN_ADDRESS,
} from "@/lib/routing/planner";
import { geocodeAddresses } from "@/lib/routing/geo";
import {
  getRouteAssistantTechnicianIds,
  loadRouteAssistantJobs,
  ROUTE_ASSISTANT_JOB_STATUSES,
} from "@/lib/routing/job-source";
import {
  BUSINESS_TIMEZONE,
  endOfBusinessDay,
  startOfBusinessDay,
} from "@/lib/timezone";
import { getRouteAssistantConfig } from "@/lib/site-settings";

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

  const {
    records,
    technicians: techniciansData,
    jobs: plannedJobs,
  } = await loadRouteAssistantJobs({
    where: {
      status: { in: [...ROUTE_ASSISTANT_JOB_STATUSES] },
      scheduledDate: { gte: dayStart, lte: dayEnd },
      plan: {
        is: {
          name: recurringPlan.name,
        },
      },
    },
  });

  if (records.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "no-jobs",
      date: routeDateKey,
      planName: recurringPlan.name,
    });
  }

  if (techniciansData.length === 0) {
    const hasTechniciansInScope =
      getRouteAssistantTechnicianIds(records).length > 0;
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: hasTechniciansInScope ? "no-active-technicians" : "no-technicians",
      date: routeDateKey,
      planName: recurringPlan.name,
    });
  }

  const originGeocoded = await geocodeAddresses([DEFAULT_ROUTE_ORIGIN_ADDRESS]);
  const originCoordinates = originGeocoded.get(DEFAULT_ROUTE_ORIGIN_ADDRESS) ?? null;

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
