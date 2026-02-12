import { NextResponse } from "next/server";
import { JobPriority, JobStatus, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getServiceTierChecklist } from "@/lib/service-tiers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
  const data: Record<string, unknown> = {};

  if (body.scheduledDate) {
    const date = new Date(String(body.scheduledDate));
    if (!Number.isNaN(date.getTime())) {
      data.scheduledDate = date;
    }
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

  const updated = await prisma.job.update({
    where: { id: jobId },
    data,
  });

  return NextResponse.json({ job: updated });
}
