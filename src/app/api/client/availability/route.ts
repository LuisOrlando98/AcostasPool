import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  MIN_BOOKING_LEAD_DAYS,
  SLOT_INTERVAL_MINUTES,
  SLOT_START_HOUR,
  TECH_DAILY_CAPACITY,
  buildAvailabilityDays,
  getLeadStartDate,
} from "@/lib/jobs/capacity";

const DEFAULT_DAYS = 56;
const MAX_DAYS = 120;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: { id: true, allowWeekendBooking: true },
  });
  if (!customer) {
    return NextResponse.json({
      leadDays: MIN_BOOKING_LEAD_DAYS,
      slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
      slotStartHour: SLOT_START_HOUR,
      jobsPerTechnicianPerDay: TECH_DAILY_CAPACITY,
      techniciansCount: 0,
      availability: [],
    });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get("days") ?? DEFAULT_DAYS);
  const days =
    Number.isFinite(daysParam) && daysParam > 0
      ? Math.min(Math.floor(daysParam), MAX_DAYS)
      : DEFAULT_DAYS;

  const startDate = getLeadStartDate(new Date(), MIN_BOOKING_LEAD_DAYS);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + days);
  endDate.setHours(23, 59, 59, 999);

  const [techniciansCount, jobs] = await Promise.all([
    prisma.technician.count({
      where: { user: { isActive: true } },
    }),
    prisma.job.findMany({
      where: {
        scheduledDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { scheduledDate: true },
    }),
  ]);

  const availability = buildAvailabilityDays({
    startDate,
    days,
    techniciansCount,
    scheduledDates: jobs.map((job) => job.scheduledDate),
    includeSaturday: customer.allowWeekendBooking,
    includeSunday: customer.allowWeekendBooking,
  })
    .filter((day) => day.remainingCapacity > 0)
    .map((day) => ({
      ...day,
      slots: day.slots.filter((slot) => slot.remaining > 0),
    }))
    .filter((day) => day.slots.length > 0);

  return NextResponse.json({
    leadDays: MIN_BOOKING_LEAD_DAYS,
    slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
    slotStartHour: SLOT_START_HOUR,
    jobsPerTechnicianPerDay: TECH_DAILY_CAPACITY,
    techniciansCount,
    availability,
  });
}
