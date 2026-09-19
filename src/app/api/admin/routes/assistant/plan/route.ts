import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { formatCustomerName } from "@/lib/customers/format";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/jobs/capacity";
import { getGlobalRecurringPlan } from "@/lib/jobs/recurring-plan-templates";
import type { AssistantPlanResponse } from "@/lib/routing/assistant-types";
import { geocodeAddresses } from "@/lib/routing/geo";
import {
  findRouteAssistantTechnicians,
  getEffectiveTechnicianId,
  loadRouteAssistantJobs,
  ROUTE_ASSISTANT_JOB_STATUSES,
  type RouteAssistantJobRecord,
} from "@/lib/routing/job-source";
import {
  buildRouteAssistantPlans,
  DEFAULT_ROUTE_ASSISTANT_STRATEGIES,
  type RouteAssistantStrategy,
} from "@/lib/routing/planner";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRouteAssistantConfig } from "@/lib/site-settings";
import { endOfBusinessDay, startOfBusinessDay } from "@/lib/timezone";

/** Planificar varias rutas con tráfico real tarda más que el límite por defecto. */
export const maxDuration = 60;

const MAX_PLAN_JOBS = 200;
const MAX_PLAN_TECHNICIANS = 20;
const MAX_PLAN_TEMPLATE_LENGTH = 32;
const MAX_ADDRESS_QUERY_LENGTH = 120;
const PLAN_RATE_LIMIT = 20;
const MS_PER_MINUTE = 60_000;
const PLAN_RATE_LIMIT_WINDOW_MS = 5 * MS_PER_MINUTE;

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_ERROR = 500;

const bodySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    planTemplate: z.string().max(MAX_PLAN_TEMPLATE_LENGTH).nullable().optional(),
    technicianIds: z
      .array(z.string().min(1))
      .max(MAX_PLAN_TECHNICIANS)
      .optional()
      .default([]),
    includeUnassigned: z.boolean().optional().default(true),
    addressQuery: z.string().max(MAX_ADDRESS_QUERY_LENGTH).optional().default(""),
  })
  .strict();

type PlanRequest = z.infer<typeof bodySchema>;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: HTTP_BAD_REQUEST });
}

function resolveStrategies(technicianCount: number): RouteAssistantStrategy[] {
  return technicianCount <= 1 ? ["SHORT_DRIVE"] : DEFAULT_ROUTE_ASSISTANT_STRATEGIES;
}

/**
 * Filtros del alcance: plan recurrente, técnico efectivo, trabajos sin técnico
 * y búsqueda por cliente o dirección. El día ya viene acotado por la consulta.
 */
function createScopeFilter(input: {
  planName: string | null;
  technicianIds: readonly string[];
  includeUnassigned: boolean;
  addressQuery: string;
}) {
  const selectedTechnicians = new Set(input.technicianIds);
  const normalizedQuery = input.addressQuery.trim().toLowerCase();
  return (record: RouteAssistantJobRecord) => {
    if (input.planName && record.plan?.name !== input.planName) {
      return false;
    }
    const technicianId = getEffectiveTechnicianId(record);
    if (!technicianId) {
      return input.includeUnassigned && matchesQuery(record, normalizedQuery);
    }
    if (selectedTechnicians.size > 0 && !selectedTechnicians.has(technicianId)) {
      return false;
    }
    return matchesQuery(record, normalizedQuery);
  };
}

function matchesQuery(record: RouteAssistantJobRecord, normalizedQuery: string) {
  if (normalizedQuery.length === 0) {
    return true;
  }
  return `${formatCustomerName(record.customer)} ${record.property.address}`
    .toLowerCase()
    .includes(normalizedQuery);
}

function emptyResponse(date: string, originAddress: string): AssistantPlanResponse {
  return {
    date,
    originAddress,
    technicians: [],
    jobsCount: 0,
    excludedCount: 0,
    unresolvedGeocodes: 0,
    unresolvedJobIds: [],
    plans: [],
  };
}

async function buildPlanResponse(input: PlanRequest) {
  const routeDate = parseDateOnly(input.date);
  if (!routeDate) {
    return badRequest("Invalid date");
  }
  const requestedTemplate = input.planTemplate?.trim() ?? "";
  const recurringPlan = requestedTemplate
    ? getGlobalRecurringPlan(requestedTemplate)
    : null;
  if (requestedTemplate && !recurringPlan) {
    return badRequest("Invalid plan template");
  }

  const config = await getRouteAssistantConfig();
  const technicians = await findRouteAssistantTechnicians(
    input.technicianIds.length > 0 ? [...input.technicianIds] : null
  );
  if (technicians.length === 0) {
    return NextResponse.json(emptyResponse(input.date, config.originAddress));
  }

  const where = {
    status: { in: [...ROUTE_ASSISTANT_JOB_STATUSES] },
    scheduledDate: {
      gte: startOfBusinessDay(routeDate) ?? routeDate,
      lte: endOfBusinessDay(routeDate) ?? routeDate,
    },
  };
  const [originGeocoded, dayJobsCount, { jobs }] = await Promise.all([
    geocodeAddresses([config.originAddress]),
    prisma.job.count({ where }),
    loadRouteAssistantJobs({
      where,
      technicians,
      filter: createScopeFilter({
        planName: recurringPlan?.name ?? null,
        technicianIds: input.technicianIds,
        includeUnassigned: input.includeUnassigned,
        addressQuery: input.addressQuery,
      }),
    }),
  ]);

  if (jobs.length > MAX_PLAN_JOBS) {
    return NextResponse.json(
      {
        error: "Too many jobs in scope",
        code: "TOO_MANY_JOBS",
        limit: MAX_PLAN_JOBS,
      },
      { status: HTTP_PAYLOAD_TOO_LARGE }
    );
  }

  const plans = await buildRouteAssistantPlans({
    jobs,
    technicians,
    originAddress: config.originAddress,
    originCoordinates: originGeocoded.get(config.originAddress) ?? null,
    strategies: resolveStrategies(technicians.length),
  });
  const unresolvedJobIds = jobs
    .filter((job) => !job.coordinates)
    .map((job) => job.id);

  return NextResponse.json({
    date: input.date,
    originAddress: config.originAddress,
    technicians,
    jobsCount: jobs.length,
    excludedCount: Math.max(0, dayJobsCount - jobs.length),
    unresolvedGeocodes: unresolvedJobIds.length,
    unresolvedJobIds,
    plans,
  } satisfies AssistantPlanResponse);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_UNAUTHORIZED });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return badRequest("Invalid request data");
  }

  const rateLimit = await checkRateLimit({
    key: `route-assistant-plan:${session.sub}`,
    limit: PLAN_RATE_LIMIT,
    windowMs: PLAN_RATE_LIMIT_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: HTTP_TOO_MANY_REQUESTS }
    );
  }

  try {
    return await buildPlanResponse(parsed.data);
  } catch (error) {
    console.error("route-assistant plan: failed", {
      userId: session.sub,
      date: parsed.data.date,
      technicianIds: parsed.data.technicianIds,
      error,
    });
    return NextResponse.json(
      { error: "Failed to build route plan" },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
