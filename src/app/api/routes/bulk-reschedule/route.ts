import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { applyJobLifecycleUpdate } from "@/lib/jobs/lifecycle";
import { endOfBusinessDay, getBusinessTimeParts } from "@/lib/timezone";

type UpdatePayload = {
  jobId: string;
  scheduledDate?: string;
  sortOrder?: number | null;
  technicianId?: string | null;
};

const toSortOrder = (value: Date) =>
  (() => {
    const parts = getBusinessTimeParts(value);
    if (!parts) {
      return 0;
    }
    return parts.hour * 60 + parts.minute;
  })();

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  if (updates.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const endOfToday = endOfBusinessDay(new Date()) ?? new Date();

  for (const update of updates as UpdatePayload[]) {
    if (!update.jobId) {
      continue;
    }
    const existing = await prisma.job.findUnique({
      where: { id: update.jobId },
      select: {
        status: true,
        scheduledDate: true,
      },
    });
    if (!existing) {
      continue;
    }

    const parsedScheduledDate =
      typeof update.scheduledDate === "string"
        ? new Date(update.scheduledDate)
        : null;
    const hasValidScheduledDate =
      parsedScheduledDate !== null &&
      !Number.isNaN(parsedScheduledDate.getTime());
    const nextScheduledDate = hasValidScheduledDate
      ? parsedScheduledDate
      : existing.scheduledDate;
    const nextSortOrder =
      typeof update.sortOrder === "number"
        ? update.sortOrder
        : update.sortOrder === null
          ? null
          : hasValidScheduledDate
            ? toSortOrder(nextScheduledDate)
            : undefined;
    const status =
      existing.status === "COMPLETED"
        ? "COMPLETED"
        : nextScheduledDate > endOfToday
          ? "SCHEDULED"
          : "PENDING";

    await applyJobLifecycleUpdate({
      jobId: update.jobId,
      actorUserId: session.sub,
      data: {
        scheduledDate: nextScheduledDate,
        sortOrder: nextSortOrder,
        technicianId:
          update.technicianId !== undefined ? update.technicianId : undefined,
        status,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
