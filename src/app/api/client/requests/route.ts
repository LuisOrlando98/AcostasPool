import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/create";
import {
  getDefaultServiceTierId,
  getServiceTierChecklist,
} from "@/lib/service-tiers";

const requestSchema = z.object({
  propertyId: z.string().min(1),
  reason: z.string().min(3),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  description: z.string().optional(),
});

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

  const { propertyId, reason, preferredDate, preferredTime, description } =
    parsed.data;

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const datePart = preferredDate ?? new Date().toISOString().slice(0, 10);
  const timePart = preferredTime ?? "09:00";
  const scheduledDate = new Date(`${datePart}T${timePart}:00`);
  const sortOrder =
    scheduledDate.getHours() * 60 + scheduledDate.getMinutes();

  const defaultTierId = await getDefaultServiceTierId();
  const checklist = await getServiceTierChecklist(defaultTierId);

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
      notes: `${reason}${description ? ` - ${description}` : ""}`,
      requestedAt: new Date(),
      requestedByUserId: session.sub,
    },
  });

  await createNotification({
    customerId: customer.id,
    recipientRole: "CUSTOMER",
    eventType: "SERVICE_SCHEDULED",
    severity: "INFO",
    actorUserId: session.sub,
    payload: {
      jobId: job.id,
      scheduledDate: job.scheduledDate.toISOString(),
    },
  });

  await createNotification({
    customerId: customer.id,
    recipientRole: "ADMIN",
    eventType: "CUSTOMER_REQUEST",
    severity: "WARNING",
    actorUserId: session.sub,
    payload: {
      jobId: job.id,
      requestedAt: (job.requestedAt ?? new Date()).toISOString(),
      preferredDate: preferredDate ?? null,
      preferredTime: preferredTime ?? null,
      reason,
    },
  });

  return NextResponse.json({ ok: true, jobId: job.id });
}
