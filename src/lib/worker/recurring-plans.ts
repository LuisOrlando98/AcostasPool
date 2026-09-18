import type { Prisma } from "@prisma/client";
import {
  materializeServicePlanJob,
  queueJobScheduledNotifications,
  type MaterializablePlan,
} from "@/lib/jobs/materialize";
import { addPlanFrequency } from "@/lib/jobs/scheduling";
import { addBusinessDays, endOfBusinessDay, startOfBusinessDay } from "@/lib/timezone";
import { RECURRING_LOOKAHEAD_DAYS } from "@/lib/worker/constants";
import type { WorkerTaskDeps } from "@/lib/worker/types";

/**
 * Materializa las visitas de los planes recurrentes activos dentro del
 * horizonte (hoy + RECURRING_LOOKAHEAD_DAYS) con `materializeServicePlanJob`,
 * que ya garantiza que no se duplica un trabajo del plan en la misma fecha, y
 * encola los avisos con `queueJobScheduledNotifications`. Al terminar mueve
 * `nextRunAt` a la primera ocurrencia fuera del horizonte (o a la pausa).
 */

export type RecurringPlanDeps = Pick<WorkerTaskDeps, "db" | "logger" | "now">;

export type RecurringPlanSummary = {
  readonly plans: number;
  readonly created: number;
  readonly advanced: number;
  readonly failed: number;
};

type PlanHorizon = {
  readonly todayStart: Date;
  readonly horizonEnd: Date;
};

type PlanOccurrences = {
  readonly dates: readonly Date[];
  readonly nextRunAt: Date;
};

const PLAN_SELECT = {
  id: true,
  customerId: true,
  propertyId: true,
  technicianId: true,
  serviceTierId: true,
  serviceType: true,
  priority: true,
  frequency: true,
  nextRunAt: true,
  estimatedDurationMinutes: true,
  checklist: true,
  notes: true,
  isActive: true,
  customer: { select: { estadoCuenta: true, pauseServicesFrom: true } },
} as const satisfies Prisma.ServicePlanSelect;

export function resolvePlanHorizon(now: Date): PlanHorizon {
  const todayStart = startOfBusinessDay(now) ?? now;
  const lastDay = addBusinessDays(now, RECURRING_LOOKAHEAD_DAYS) ?? now;
  const horizonEnd = endOfBusinessDay(lastDay) ?? lastDay;
  return { todayStart, horizonEnd };
}

/** Primera ocurrencia >= inicio de hoy: avanza las fechas pasadas frecuencia a frecuencia. */
function firstOccurrenceFrom(nextRunAt: Date, frequency: string, todayStart: Date): Date {
  let cursor = nextRunAt;
  while (cursor.getTime() < todayStart.getTime()) {
    cursor = addPlanFrequency(cursor, frequency);
  }
  return cursor;
}

function isPausedOn(plan: MaterializablePlan, date: Date): boolean {
  const pauseFrom = plan.customer.pauseServicesFrom;
  return pauseFrom !== null && date.getTime() >= pauseFrom.getTime();
}

/** Ocurrencias dentro del horizonte (hasta la pausa del cliente) y el `nextRunAt` resultante. */
export function listPlanOccurrences(
  plan: MaterializablePlan,
  horizon: PlanHorizon
): PlanOccurrences {
  const dates: Date[] = [];
  let cursor = firstOccurrenceFrom(plan.nextRunAt, plan.frequency, horizon.todayStart);
  while (cursor.getTime() <= horizon.horizonEnd.getTime() && !isPausedOn(plan, cursor)) {
    dates.push(cursor);
    cursor = addPlanFrequency(cursor, plan.frequency);
  }
  return { dates, nextRunAt: cursor };
}

async function materializePlan(
  deps: RecurringPlanDeps,
  plan: MaterializablePlan,
  horizon: PlanHorizon
) {
  const { db, logger, now } = deps;
  if (Number.isNaN(plan.nextRunAt.getTime())) {
    logger.warn("service plan with invalid nextRunAt skipped", { planId: plan.id });
    return { created: 0, advanced: false };
  }
  const { dates, nextRunAt } = listPlanOccurrences(plan, horizon);

  let created = 0;
  for (const scheduledDate of dates) {
    const job = await materializeServicePlanJob(db, plan, { now, scheduledDate });
    if (!job) {
      continue;
    }
    await queueJobScheduledNotifications(job);
    created += 1;
  }

  const advanced = nextRunAt.getTime() !== plan.nextRunAt.getTime();
  if (advanced) {
    await db.servicePlan.update({ where: { id: plan.id }, data: { nextRunAt } });
  }
  return { created, advanced };
}

export async function processRecurringPlans(
  deps: RecurringPlanDeps
): Promise<RecurringPlanSummary> {
  const { db, logger, now } = deps;
  const horizon = resolvePlanHorizon(now);
  const plans = await db.servicePlan.findMany({
    where: { isActive: true, customer: { estadoCuenta: "ACTIVE" } },
    select: PLAN_SELECT,
    orderBy: { nextRunAt: "asc" },
  });

  let created = 0;
  let advanced = 0;
  let failed = 0;
  for (const plan of plans) {
    try {
      const result = await materializePlan(deps, plan, horizon);
      created += result.created;
      advanced += result.advanced ? 1 : 0;
    } catch (error) {
      failed += 1;
      logger.error("recurring plan materialization failed", { planId: plan.id, error });
    }
  }
  return { plans: plans.length, created, advanced, failed };
}
