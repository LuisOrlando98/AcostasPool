import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  applyJobLifecycleUpdate,
  JOB_LIFECYCLE_SNAPSHOT_SELECT,
  type JobLifecycleSnapshot,
  type UpdatedLifecycleJob,
} from "@/lib/jobs/lifecycle";
import { resolveRescheduledStatus } from "@/lib/jobs/reschedule-status";
import { endOfBusinessDay, getBusinessTimeParts } from "@/lib/timezone";

/**
 * POST /api/routes/bulk-reschedule
 *
 * Body: { updates: [{ jobId, scheduledDate?, sortOrder?, technicianId? }] } (máx. 200 elementos;
 * es la forma que envía RoutesCalendar: `{ jobId, ...PendingUpdate }`).
 *
 * Respuestas:
 * - 200 { ok: true, applied: string[], skipped: string[], failed: [] }
 * - 500 { ok: false, applied, skipped, failed: [{ id, error }] } si algún elemento falló (el
 *   cliente conserva sus cambios pendientes y puede reintentar: reaplicar es idempotente).
 * - 400 { error: "Invalid payload", issues } si el body no valida.
 *
 * Cada elemento se procesa en su propia transacción (la que abre applyJobLifecycleUpdate) en lugar
 * de una transacción única para todo el lote: son operaciones independientes que ya no eran
 * atómicas entre sí, 200 elementos (≈10 sentencias cada uno) superarían el timeout interactivo de
 * Prisma reteniendo bloqueos durante segundos, y la publicación en tiempo real debe ocurrir tras
 * cada commit. Los jobs inexistentes se omiten (`skipped`), como antes. El estado previo de todos
 * los jobs se carga en una sola consulta y se pasa como `preloaded` (sin doble lectura).
 */

const MAX_UPDATES_PER_REQUEST = 200;
const MINUTES_PER_HOUR = 60;
const ERROR_MESSAGE_MAX_LENGTH = 200;

const isParseableDate = (value: string) =>
  !Number.isNaN(new Date(value).getTime());

const updateSchema = z
  .object({
    jobId: z.string().min(1),
    scheduledDate: z
      .string()
      .refine(isParseableDate, { message: "Invalid date" })
      .optional(),
    sortOrder: z.number().int().nullable().optional(),
    technicianId: z.string().min(1).nullable().optional(),
  })
  .strict();

const bodySchema = z
  .object({ updates: z.array(updateSchema).max(MAX_UPDATES_PER_REQUEST) })
  .strict();

type RescheduleUpdate = z.infer<typeof updateSchema>;
type FailedUpdate = { id: string; error: string };
type BatchState = {
  snapshots: ReadonlyMap<string, JobLifecycleSnapshot>;
  applied: readonly string[];
  skipped: readonly string[];
  failed: readonly FailedUpdate[];
};

const toSortOrder = (value: Date) => {
  const parts = getBusinessTimeParts(value);
  if (!parts) {
    return 0;
  }
  return parts.hour * MINUTES_PER_HOUR + parts.minute;
};

function resolveSortOrder(
  update: RescheduleUpdate,
  parsedScheduledDate: Date | null
) {
  if (typeof update.sortOrder === "number") {
    return update.sortOrder;
  }
  if (update.sortOrder === null) {
    return null;
  }
  return parsedScheduledDate ? toSortOrder(parsedScheduledDate) : undefined;
}

function resolveTechnician(
  technicianId: RescheduleUpdate["technicianId"]
): Prisma.JobUpdateInput["technician"] {
  if (technicianId === undefined) {
    return undefined;
  }
  if (technicianId === null) {
    return { disconnect: true };
  }
  return { connect: { id: technicianId } };
}

function buildUpdateData(
  update: RescheduleUpdate,
  existing: JobLifecycleSnapshot,
  endOfToday: Date
): Prisma.JobUpdateInput {
  const parsedScheduledDate =
    update.scheduledDate !== undefined ? new Date(update.scheduledDate) : null;
  const nextScheduledDate = parsedScheduledDate ?? existing.scheduledDate;
  const status = resolveRescheduledStatus({
    currentStatus: existing.status,
    currentScheduledDate: existing.scheduledDate,
    nextScheduledDate,
    endOfToday,
  });
  return {
    scheduledDate: nextScheduledDate,
    sortOrder: resolveSortOrder(update, parsedScheduledDate),
    technician: resolveTechnician(update.technicianId),
    status,
  };
}

function toSnapshot(job: UpdatedLifecycleJob): JobLifecycleSnapshot {
  return {
    id: job.id,
    scheduledDate: job.scheduledDate,
    technicianId: job.technicianId,
    sortOrder: job.sortOrder,
    status: job.status,
    priority: job.priority,
    serviceType: job.serviceType,
    notes: job.notes,
    customerNotes: job.customerNotes,
  };
}

function summarizeError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `Database error ${error.code}`;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, ERROR_MESSAGE_MAX_LENGTH);
}

async function applyOne(
  state: BatchState,
  update: RescheduleUpdate,
  endOfToday: Date,
  actorUserId: string
): Promise<BatchState> {
  const existing = state.snapshots.get(update.jobId);
  if (!existing) {
    return { ...state, skipped: [...state.skipped, update.jobId] };
  }
  try {
    const updated = await applyJobLifecycleUpdate({
      jobId: update.jobId,
      actorUserId,
      preloaded: existing,
      data: buildUpdateData(update, existing, endOfToday),
    });
    if (!updated) {
      return { ...state, skipped: [...state.skipped, update.jobId] };
    }
    return {
      ...state,
      // Un segundo cambio sobre el mismo job en el lote parte del estado recién aplicado.
      snapshots: new Map(state.snapshots).set(update.jobId, toSnapshot(updated)),
      applied: [...state.applied, update.jobId],
    };
  } catch (error) {
    console.error("bulk-reschedule: job update failed", {
      jobId: update.jobId,
      actorUserId,
      error,
    });
    return {
      ...state,
      failed: [...state.failed, { id: update.jobId, error: summarizeError(error) }],
    };
  }
}

async function applyBatch(
  updates: readonly RescheduleUpdate[],
  snapshots: ReadonlyMap<string, JobLifecycleSnapshot>,
  endOfToday: Date,
  actorUserId: string
): Promise<BatchState> {
  let state: BatchState = { snapshots, applied: [], skipped: [], failed: [] };
  for (const update of updates) {
    state = await applyOne(state, update, endOfToday, actorUserId);
  }
  return state;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { updates } = parsed.data;
  const jobIds = [...new Set(updates.map((update) => update.jobId))];
  const jobs =
    jobIds.length > 0
      ? await prisma.job.findMany({
          where: { id: { in: jobIds } },
          select: JOB_LIFECYCLE_SNAPSHOT_SELECT,
        })
      : [];
  const snapshots = new Map(jobs.map((job) => [job.id, job]));
  const endOfToday = endOfBusinessDay(new Date()) ?? new Date();

  const result = await applyBatch(updates, snapshots, endOfToday, session.sub);
  const ok = result.failed.length === 0;
  return NextResponse.json(
    {
      ok,
      applied: result.applied,
      skipped: result.skipped,
      failed: result.failed,
    },
    { status: ok ? 200 : 500 }
  );
}
