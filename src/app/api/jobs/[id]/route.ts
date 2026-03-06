import { NextResponse } from "next/server";
import { JobPriority, JobStatus, ServiceType, type Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { getServiceTierChecklist } from "@/lib/service-tiers";
import { applyJobLifecycleUpdate } from "@/lib/jobs/lifecycle";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit/log";
import { getBusinessTimeParts } from "@/lib/timezone";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const toSortOrder = (value: Date) =>
  (() => {
    const parts = getBusinessTimeParts(value);
    return (parts?.hour ?? 0) * 60 + (parts?.minute ?? 0);
  })();

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: routeJobId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const jobId = routeJobId ?? body?.jobId;
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }
  const data: Prisma.JobUpdateInput = {};
  let nextScheduledDate: Date | null = null;

  if (body.scheduledDate) {
    const date = new Date(String(body.scheduledDate));
    if (!Number.isNaN(date.getTime())) {
      data.scheduledDate = date;
      nextScheduledDate = date;
    }
  }

  if (typeof body.sortOrder === "number") {
    data.sortOrder = body.sortOrder;
  } else if (body.sortOrder === null) {
    data.sortOrder = null;
  } else if (nextScheduledDate) {
    data.sortOrder = toSortOrder(nextScheduledDate);
  }

  if (
    typeof body.status === "string" &&
    Object.values(JobStatus).includes(body.status as JobStatus)
  ) {
    data.status = body.status as JobStatus;
  }

  if (
    typeof body.priority === "string" &&
    Object.values(JobPriority).includes(body.priority as JobPriority)
  ) {
    data.priority = body.priority as JobPriority;
  }

  if (
    typeof body.serviceType === "string" &&
    Object.values(ServiceType).includes(body.serviceType as ServiceType)
  ) {
    data.serviceType = body.serviceType as ServiceType;
  }

  const serviceTierProvided = body.serviceTierId !== undefined;
  if (body.serviceTierId === null || body.serviceTierId === "") {
    data.serviceTierId = null;
    data.checklist = await getServiceTierChecklist(null);
  } else if (typeof body.serviceTierId === "string") {
    data.serviceTierId = body.serviceTierId;
    data.checklist = await getServiceTierChecklist(body.serviceTierId);
  }

  if (body.technicianId === null || body.technicianId === "") {
    data.technicianId = null;
  } else if (typeof body.technicianId === "string") {
    data.technicianId = body.technicianId;
  }

  if (typeof body.notes === "string" || body.notes === null) {
    data.notes = body.notes;
  }
  if (typeof body.customerNotes === "string" || body.customerNotes === null) {
    data.customerNotes = body.customerNotes;
  }

  if (!serviceTierProvided && Array.isArray(body.checklist)) {
    data.checklist = body.checklist;
  }

  const updated = await applyJobLifecycleUpdate({
    jobId,
    data,
    actorUserId: session.sub,
  });
  if (!updated) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job: updated });
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  const existing = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      customerId: true,
      propertyId: true,
      technicianId: true,
      scheduledDate: true,
      status: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.updateMany({
      where: { jobId },
      data: { jobId: null },
    });
    await tx.emailLog.updateMany({
      where: { jobId },
      data: { jobId: null },
    });
    await tx.techDigestItem.deleteMany({
      where: { jobId },
    });
    await tx.jobPhoto.deleteMany({
      where: { jobId },
    });
    await tx.job.delete({
      where: { id: jobId },
    });
  });

  await logAuditEvent({
    userId: session.sub,
    action: "JOB_DELETED",
    entity: "Job",
    entityId: jobId,
    metadata: {
      customerId: existing.customerId,
      propertyId: existing.propertyId,
      technicianId: existing.technicianId,
      scheduledDate: existing.scheduledDate.toISOString(),
      status: existing.status,
    },
  });

  return NextResponse.json({ deleted: true, jobId });
}
