import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/jobs/capacity";
import { applyJobLifecycleUpdate } from "@/lib/jobs/lifecycle";
import { getGlobalRecurringPlanByWeekday } from "@/lib/jobs/recurring-plan-templates";
import type { AssistantUpdate } from "@/lib/routing/assistant-types";
import {
  buildRouteAssistantPlans,
  type RouteAssistantJob,
  type RouteAssistantTechnician,
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
import {
  getRouteAssistantConfig,
  type RouteAssistantConfig,
} from "@/lib/site-settings";

/** Tope de trabajos que una pasada automática puede reordenar. */
const MAX_AUTO_OPTIMIZE_UPDATES = 200;
/** Fila de auditoría de sistema (sin userId) de cada pasada aplicada. */
const AUTO_OPTIMIZE_AUDIT_ACTION = "ROUTE_ASSISTANT_AUTO_OPTIMIZE";
const AUTO_OPTIMIZE_AUDIT_ENTITY = "Job";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type RunContext = {
  readonly date: string;
  readonly planName: string;
};

type ApplySummary = {
  readonly applied: number;
  readonly failed: number;
};

type DailyScope = {
  readonly technicians: RouteAssistantTechnician[];
  readonly jobs: RouteAssistantJob[];
};

/**
 * Compares two secrets without leaking, through the comparison time, how many
 * leading characters a guess got right. Lengths are compared first because
 * `timingSafeEqual` requires buffers of the same size; the length of the secret
 * is not itself a useful hint.
 */
function timingSafeEqualStrings(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function hasValidCronSecret(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return false;
  }
  const received = request.headers.get("x-cron-secret")?.trim();
  if (!received) {
    return false;
  }
  return timingSafeEqualStrings(received, expected);
}

function skipResponse(reason: string, context?: RunContext) {
  return NextResponse.json({ ok: true, skipped: true, reason, ...context });
}

/** Trabajos del plan recurrente del día, con sus técnicos activos. */
async function loadDailyScope(
  routeDate: Date,
  planName: string
): Promise<DailyScope | { readonly skipReason: string }> {
  const { records, technicians, jobs } = await loadRouteAssistantJobs({
    where: {
      status: { in: [...ROUTE_ASSISTANT_JOB_STATUSES] },
      scheduledDate: {
        gte: startOfBusinessDay(routeDate) ?? routeDate,
        lte: endOfBusinessDay(routeDate) ?? routeDate,
      },
      plan: { is: { name: planName } },
    },
  });
  if (records.length === 0) {
    return { skipReason: "no-jobs" };
  }
  if (technicians.length === 0) {
    const hasTechniciansInScope =
      getRouteAssistantTechnicianIds(records).length > 0;
    return {
      skipReason: hasTechniciansInScope ? "no-active-technicians" : "no-technicians",
    };
  }
  return { technicians, jobs };
}

/**
 * Aplica los reordenamientos uno a uno: un trabajo que falle (por ejemplo, si
 * lo borran entre la planificación y la escritura) no puede tumbar la pasada.
 */
async function applyUpdates(
  updates: readonly AssistantUpdate[]
): Promise<ApplySummary> {
  let applied = 0;
  let failed = 0;
  for (const update of updates) {
    try {
      await applyJobLifecycleUpdate({
        jobId: update.jobId,
        actorUserId: null,
        data: {
          sortOrder: update.sortOrder,
          technician: { connect: { id: update.technicianId } },
        },
      });
      applied += 1;
    } catch (error) {
      failed += 1;
      console.error("route-assistant auto-optimize: job update failed", {
        jobId: update.jobId,
        technicianId: update.technicianId,
        error,
      });
    }
  }
  return { applied, failed };
}

async function recordAudit(
  context: RunContext,
  summary: ApplySummary,
  skipped: number
) {
  try {
    await prisma.auditLog.create({
      data: {
        action: AUTO_OPTIMIZE_AUDIT_ACTION,
        entity: AUTO_OPTIMIZE_AUDIT_ENTITY,
        metadata: {
          date: context.date,
          planName: context.planName,
          applied: summary.applied,
          failed: summary.failed,
          skipped,
        },
      },
    });
  } catch (error) {
    console.error("route-assistant auto-optimize: audit write failed", {
      date: context.date,
      error,
    });
  }
}

async function optimizeScope(
  scope: DailyScope,
  config: RouteAssistantConfig,
  context: RunContext
) {
  const originGeocoded = await geocodeAddresses([config.originAddress]);
  // KEEP_ASSIGNMENTS solo reordena: los trabajos sin técnico quedan en
  // `unassigned` y una pasada automática nunca se los adjudica a nadie.
  const [plan] = await buildRouteAssistantPlans({
    jobs: scope.jobs,
    technicians: scope.technicians,
    originAddress: config.originAddress,
    originCoordinates: originGeocoded.get(config.originAddress) ?? null,
    strategies: ["KEEP_ASSIGNMENTS"],
  });
  if (!plan || plan.updates.length === 0) {
    return skipResponse("no-updates", context);
  }

  const updates = plan.updates.slice(0, MAX_AUTO_OPTIMIZE_UPDATES);
  const skipped = plan.updates.length - updates.length;
  const summary = await applyUpdates(updates);
  await recordAudit(context, summary, skipped);

  return NextResponse.json({
    ok: summary.failed === 0,
    ...context,
    technicians: scope.technicians.length,
    jobsCount: scope.jobs.length,
    applied: summary.applied,
    failed: summary.failed,
    skippedUpdates: skipped,
    unassignedCount: plan.unassigned.length,
    unresolvedGeocodes: scope.jobs.filter((job) => !job.coordinates).length,
    summary: plan.summary,
  });
}

export async function POST(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_UNAUTHORIZED });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request data" },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const config = await getRouteAssistantConfig();
  if (!config.dailyAutoOptimizeEnabled) {
    return skipResponse("disabled");
  }

  const date =
    parsed.data.date ??
    DateTime.now().setZone(BUSINESS_TIMEZONE).toFormat("yyyy-MM-dd");
  const routeDate = parseDateOnly(date);
  if (!routeDate) {
    return NextResponse.json({ error: "Invalid date" }, { status: HTTP_BAD_REQUEST });
  }

  const weekday = DateTime.fromISO(date, { zone: BUSINESS_TIMEZONE }).weekday;
  const recurringPlan = getGlobalRecurringPlanByWeekday(weekday);
  if (!recurringPlan) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "no-plan-for-day",
      date,
    });
  }

  const context: RunContext = { date, planName: recurringPlan.name };
  const scope = await loadDailyScope(routeDate, recurringPlan.name);
  if ("skipReason" in scope) {
    return skipResponse(scope.skipReason, context);
  }
  return optimizeScope(scope, config, context);
}
