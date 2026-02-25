import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { applyJobLifecycleUpdate } from "@/lib/jobs/lifecycle";

type UpdatePayload = {
  jobId: string;
  scheduledDate?: string;
  sortOrder?: number | null;
  technicianId?: string | null;
};

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

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

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

    const nextScheduledDate = update.scheduledDate
      ? new Date(update.scheduledDate)
      : existing.scheduledDate;
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
        sortOrder:
          typeof update.sortOrder === "number"
            ? update.sortOrder
            : update.sortOrder === null
              ? null
              : undefined,
        technicianId:
          update.technicianId !== undefined ? update.technicianId : undefined,
        status,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
