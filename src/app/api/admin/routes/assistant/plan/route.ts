import { NextResponse } from "next/server";
import { z } from "zod";
import type { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { formatCustomerName } from "@/lib/customers/format";
import { parseDateOnly, toDateKey } from "@/lib/jobs/capacity";
import {
  buildRecurringRouteGroupId,
  buildRecurringRouteGroupLabel,
  getGlobalRecurringPlan,
  isGlobalRecurringPlanName,
} from "@/lib/jobs/recurring-plan-templates";
import { geocodeAddresses } from "@/lib/routing/geo";
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

const statusValues = ["SCHEDULED", "PENDING", "ON_THE_WAY", "IN_PROGRESS"] as const;

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ignoreDate: z.boolean().optional().default(false),
  technicianIds: z.array(z.string().min(1)).max(100).optional().default([]),
  planTemplate: z.string().max(32).optional().nullable(),
  addressQuery: z.string().max(120).optional().default(""),
  statuses: z.array(z.enum(statusValues)).optional().default([...statusValues]),
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

  const [technicians, jobs] = await Promise.all([
    prisma.technician.findMany({
      where: {
        user: { isActive: true },
        ...(technicianIds.length > 0 ? { id: { in: technicianIds } } : {}),
      },
      orderBy: { user: { fullName: "asc" } },
      select: {
        id: true,
        user: { select: { fullName: true } },
      },
    }),
    prisma.job.findMany({
      where: {
        status: { in: statuses as JobStatus[] },
        ...(scheduledDateFilter ? { scheduledDate: scheduledDateFilter } : {}),
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
    }),
  ]);

  const techniciansData = technicians.map((technician) => ({
    id: technician.id,
    name: technician.user.fullName,
  }));
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
  const jobsForPlanning = ignoreDate
    ? jobs
    : jobs.filter((job) => toDateKey(job.scheduledDate) === date);
  const filteredJobs = jobsForPlanning.filter((job) => {
    const effectiveTechnicianId = job.plan?.technicianId ?? job.technicianId ?? null;
    if (selectedRecurringPlan && job.plan?.name !== selectedRecurringPlan.name) {
      return false;
    }
    if (
      technicianIds.length > 0
    ) {
      if (!effectiveTechnicianId || !selectedTechnicianSet.has(effectiveTechnicianId)) {
        return false;
      }
    }
    if (normalizedQuery.length === 0) {
      return true;
    }
    const customerName = formatCustomerName(job.customer);
    return `${customerName} ${job.property.address}`
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const geocoded = await geocodeAddresses(
    [
      DEFAULT_ROUTE_ORIGIN_ADDRESS,
      ...filteredJobs.map((job) => job.property.address),
    ]
  );
  const originCoordinates = geocoded.get(DEFAULT_ROUTE_ORIGIN_ADDRESS) ?? null;

  const plannedJobs = filteredJobs.map((job) => ({
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
