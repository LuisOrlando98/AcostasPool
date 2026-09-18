import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { formatCustomerName } from "@/lib/customers/format";
import { parseDateOnly, toDateKey } from "@/lib/jobs/capacity";
import { getGlobalRecurringPlan } from "@/lib/jobs/recurring-plan-templates";
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
  DEFAULT_ROUTE_ORIGIN_ADDRESS,
} from "@/lib/routing/planner";
import {
  addBusinessDays,
  endOfBusinessDay,
  startOfBusinessDay,
} from "@/lib/timezone";

const MAX_TECHNICIAN_IDS = 100;
const MAX_PLAN_TEMPLATE_LENGTH = 32;
const MAX_ADDRESS_QUERY_LENGTH = 120;

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ignoreDate: z.boolean().optional().default(false),
  technicianIds: z.array(z.string().min(1)).max(MAX_TECHNICIAN_IDS).optional().default([]),
  planTemplate: z.string().max(MAX_PLAN_TEMPLATE_LENGTH).optional().nullable(),
  addressQuery: z.string().max(MAX_ADDRESS_QUERY_LENGTH).optional().default(""),
  statuses: z
    .array(z.enum(ROUTE_ASSISTANT_JOB_STATUSES))
    .optional()
    .default([...ROUTE_ASSISTANT_JOB_STATUSES]),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { date, ignoreDate, technicianIds, planTemplate, addressQuery, statuses } =
    parsed.data;
  const routeDate = parseDateOnly(date);
  if (!routeDate && !ignoreDate) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const selectedRecurringPlan =
    typeof planTemplate === "string" && planTemplate.trim()
      ? getGlobalRecurringPlan(planTemplate.trim())
      : null;

  let scheduledDateFilter: { gte: Date; lte?: Date } | undefined;
  if (ignoreDate) {
    const startOfToday = startOfBusinessDay(new Date()) ?? new Date();
    scheduledDateFilter = { gte: startOfToday };
  } else if (routeDate) {
    const searchStart =
      startOfBusinessDay(addBusinessDays(routeDate, -1) ?? routeDate) ?? routeDate;
    const searchEnd =
      endOfBusinessDay(addBusinessDays(routeDate, 1) ?? routeDate) ?? routeDate;
    scheduledDateFilter = {
      gte: searchStart,
      lte: searchEnd,
    };
  }

  const techniciansData = await findRouteAssistantTechnicians(
    technicianIds.length > 0 ? technicianIds : null
  );
  if (techniciansData.length === 0) {
    return NextResponse.json({
      date,
      originAddress: DEFAULT_ROUTE_ORIGIN_ADDRESS,
      technicians: [],
      jobsCount: 0,
      unresolvedGeocodes: 0,
      plans: [],
    });
  }

  const normalizedQuery = addressQuery.trim().toLowerCase();
  const selectedTechnicianSet = new Set(techniciansData.map((technician) => technician.id));
  const matchesRequestFilters = (job: RouteAssistantJobRecord) => {
    if (!ignoreDate && toDateKey(job.scheduledDate) !== date) {
      return false;
    }
    if (selectedRecurringPlan && job.plan?.name !== selectedRecurringPlan.name) {
      return false;
    }
    const effectiveTechnicianId = getEffectiveTechnicianId(job);
    if (
      technicianIds.length > 0 &&
      (!effectiveTechnicianId || !selectedTechnicianSet.has(effectiveTechnicianId))
    ) {
      return false;
    }
    if (normalizedQuery.length === 0) {
      return true;
    }
    const customerName = formatCustomerName(job.customer);
    return `${customerName} ${job.property.address}`
      .toLowerCase()
      .includes(normalizedQuery);
  };

  const [originGeocoded, { jobs: plannedJobs }] = await Promise.all([
    geocodeAddresses([DEFAULT_ROUTE_ORIGIN_ADDRESS]),
    loadRouteAssistantJobs({
      where: {
        status: { in: statuses },
        ...(scheduledDateFilter ? { scheduledDate: scheduledDateFilter } : {}),
      },
      technicians: techniciansData,
      filter: matchesRequestFilters,
    }),
  ]);
  const originCoordinates = originGeocoded.get(DEFAULT_ROUTE_ORIGIN_ADDRESS) ?? null;

  const plans = await buildRouteAssistantPlans({
    jobs: plannedJobs,
    technicians: techniciansData,
    originAddress: DEFAULT_ROUTE_ORIGIN_ADDRESS,
    originCoordinates,
    strategies:
      technicianIds.length === 1
        ? ["SHORT_DRIVE"]
        : DEFAULT_ROUTE_ASSISTANT_STRATEGIES,
  });

  return NextResponse.json({
    date,
    originAddress: DEFAULT_ROUTE_ORIGIN_ADDRESS,
    technicians: techniciansData,
    jobsCount: plannedJobs.length,
    unresolvedGeocodes: plannedJobs.filter((job) => !job.coordinates).length,
    plans,
  });
}
