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
import { combineDateAndTime } from "@/lib/jobs/scheduling";
import { MIN_BOOKING_LEAD_DAYS, getLeadStartDate, toDateKey } from "@/lib/jobs/capacity";
import { getBusinessTimeParts } from "@/lib/timezone";

const requestSchema = z.object({
  propertyId: z.string().min(1),
  reason: z.string().min(3),
  description: z.string().optional(),
  availableWeekdays: z.array(z.number().int().min(0).max(6)).min(1),
});

const DEFAULT_REQUEST_TIME = "09:00";

function findEarliestMatchingDate(leadStart: Date, weekdays: number[]) {
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(leadStart);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    if (weekdays.includes(candidate.getUTCDay())) {
      return candidate;
    }
  }
  return leadStart;
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

  const { propertyId, reason, description, availableWeekdays } = parsed.data;

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: {
      id: true,
      allowWeekendBooking: true,
      estadoCuenta: true,
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

  const allowedWeekdays = customer.allowWeekendBooking
    ? availableWeekdays
    : availableWeekdays.filter((day) => day !== 0 && day !== 6);
  if (allowedWeekdays.length === 0) {
    return NextResponse.json(
      { error: "Select at least one available weekday." },
      { status: 400 }
    );
  }

  const leadStart = getLeadStartDate(new Date(), MIN_BOOKING_LEAD_DAYS);
  const placeholderDate = findEarliestMatchingDate(leadStart, allowedWeekdays);
  const scheduledDate = combineDateAndTime(
    toDateKey(placeholderDate),
    DEFAULT_REQUEST_TIME
  );

  const defaultTierId = await getDefaultServiceTierId();
  const checklist = await getServiceTierChecklist(defaultTierId);
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const availabilityNote = `Available: ${allowedWeekdays
    .slice()
    .sort()
    .map((day) => weekdayLabels[day])
    .join(", ")}`;
  const notes = [reason, description?.trim() || null, availabilityNote]
    .filter(Boolean)
    .join("\n");

  const now = new Date();
  const sortOrder =
    (getBusinessTimeParts(scheduledDate)?.hour ?? 0) * 60 +
    (getBusinessTimeParts(scheduledDate)?.minute ?? 0);

  const job = await prisma.job.create({
    data: {
      customerId: customer.id,
      propertyId,
      scheduledDate,
      sortOrder,
      status: "PENDING",
      type: "ON_DEMAND",
      serviceTierId: defaultTierId,
      checklist,
      notes,
      requestedAt: now,
      requestedByUserId: session.sub,
    },
    select: { id: true, scheduledDate: true, status: true },
  });

  await createNotification({
    customerId: customer.id,
    recipientRole: "CUSTOMER",
    eventType: "SERVICE_SCHEDULED",
    severity: "INFO",
    actorUserId: session.sub,
    payload: {
      jobId: job.id,
      reviewRequired: true,
    },
  });

  await createNotification({
    customerId: customer.id,
    recipientRole: "ADMIN",
    eventType: "CUSTOMER_REQUEST",
    severity: "WARNING",
    actorUserId: session.sub,
    payload: {
      jobIds: [job.id],
      count: 1,
      requestedAt: now.toISOString(),
      reason,
      reviewRequired: true,
    },
  });

  await logAuditEvent({
    userId: session.sub,
    action: "CUSTOMER_REQUEST_CREATED",
    entity: "Job",
    metadata: {
      customerId: customer.id,
      propertyId,
      jobIds: [job.id],
      reason,
      availableWeekdays: allowedWeekdays,
    },
  });

  return NextResponse.json({ ok: true, jobId: job.id });
}
