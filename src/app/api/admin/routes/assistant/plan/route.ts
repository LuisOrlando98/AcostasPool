import { NextResponse } from "next/server";
import { z } from "zod";
import type { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { formatCustomerName } from "@/lib/customers/format";
import { parseDateOnly, toDateKey } from "@/lib/jobs/capacity";
import { geocodeAddresses } from "@/lib/routing/geo";
import { buildRouteAssistantPlans } from "@/lib/routing/planner";

const statusValues = ["SCHEDULED", "PENDING", "ON_THE_WAY", "IN_PROGRESS"] as const;

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ignoreDate: z.boolean().optional().default(false),
  technicianIds: z.array(z.string().min(1)).max(100).optional().default([]),
  addressQuery: z.string().max(120).optional().default(""),
  statuses: z.array(z.enum(statusValues)).optional().default(statusValues),
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

  const { date, ignoreDate, technicianIds, addressQuery, statuses } = parsed.data;
  const routeDate = parseDateOnly(date);
  if (!routeDate && !ignoreDate) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  let scheduledDateFilter: { gte: Date; lte?: Date } | undefined;
  if (ignoreDate) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    scheduledDateFilter = { gte: startOfToday };
  } else if (routeDate) {
    const searchStart = new Date(routeDate);
    searchStart.setUTCDate(searchStart.getUTCDate() - 1);
    searchStart.setUTCHours(0, 0, 0, 0);
    const searchEnd = new Date(routeDate);
    searchEnd.setUTCDate(searchEnd.getUTCDate() + 1);
    searchEnd.setUTCHours(23, 59, 59, 999);
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
      technicians: [],
      jobsCount: 0,
      unresolvedGeocodes: 0,
      plans: [],
    });
  }

  const normalizedQuery = addressQuery.trim().toLowerCase();
  const jobsForPlanning = ignoreDate
    ? jobs
    : jobs.filter((job) => toDateKey(job.scheduledDate) === date);
  const filteredJobs = jobsForPlanning.filter((job) => {
    if (normalizedQuery.length === 0) {
      return true;
    }
    const customerName = formatCustomerName(job.customer);
    return `${customerName} ${job.property.address}`
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const geocoded = await geocodeAddresses(
    filteredJobs.map((job) => job.property.address)
  );

  const plannedJobs = filteredJobs.map((job) => ({
    id: job.id,
    customerName: formatCustomerName(job.customer),
    address: job.property.address,
    technicianId: job.technicianId,
    scheduledDate: job.scheduledDate,
    estimatedDurationMinutes: job.estimatedDurationMinutes,
    coordinates: geocoded.get(job.property.address) ?? null,
  }));

  const plans = await buildRouteAssistantPlans({
    jobs: plannedJobs,
    technicians: techniciansData,
  });

  return NextResponse.json({
    date,
    technicians: techniciansData,
    jobsCount: plannedJobs.length,
    unresolvedGeocodes: plannedJobs.filter((job) => !job.coordinates).length,
    plans,
  });
}
