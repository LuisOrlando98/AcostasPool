import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { parseDateOnly } from "@/lib/jobs/capacity";
import type { AssistantRecalculateResponse } from "@/lib/routing/assistant-types";
import { geocodeAddresses } from "@/lib/routing/geo";
import {
  findRouteAssistantTechnicians,
  loadRouteAssistantJobsByIds,
} from "@/lib/routing/job-source";
import {
  buildFixedOrderPlan,
  type FixedOrderRouteInput,
} from "@/lib/routing/planner";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRouteAssistantConfig } from "@/lib/site-settings";

/**
 * POST /api/admin/routes/assistant/recalculate
 *
 * Recalcula los tiempos de una propuesta editada a mano: respeta el orden
 * recibido, carga los trabajos por id (sin filtros de plan ni de técnico) y
 * solo pide a travel los tramos consecutivos. Devuelve un plan `MANUAL`.
 */
export const maxDuration = 60;

const MAX_RECALCULATE_JOBS = 200;
const MAX_RECALCULATE_ROUTES = 20;
const RECALCULATE_RATE_LIMIT = 20;
const MS_PER_MINUTE = 60_000;
const RECALCULATE_RATE_LIMIT_WINDOW_MS = 5 * MS_PER_MINUTE;

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_ERROR = 500;

const bodySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    routes: z
      .array(
        z
          .object({
            technicianId: z.string().min(1),
            // El tope de 200 se comprueba sobre el total de las rutas, para
            // poder responder 413 con `TOO_MANY_JOBS` en vez de un 400 opaco.
            jobIds: z.array(z.string().min(1)),
          })
          .strict()
      )
      .max(MAX_RECALCULATE_ROUTES),
  })
  .strict();

type RecalculateRequest = z.infer<typeof bodySchema>;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: HTTP_BAD_REQUEST });
}

function collectJobIds(input: RecalculateRequest) {
  return input.routes.flatMap((route) => route.jobIds);
}

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length;
}

async function resolveRoutes(
  input: RecalculateRequest
): Promise<FixedOrderRouteInput[] | null> {
  const technicianIds = input.routes.map((route) => route.technicianId);
  if (technicianIds.length === 0) {
    return [];
  }
  if (hasDuplicates(technicianIds)) {
    return null;
  }
  const technicians = await findRouteAssistantTechnicians(technicianIds);
  const byId = new Map(technicians.map((technician) => [technician.id, technician]));
  if (byId.size !== technicianIds.length) {
    return null;
  }
  return input.routes.flatMap((route) => {
    const technician = byId.get(route.technicianId);
    return technician ? [{ technician, jobIds: route.jobIds }] : [];
  });
}

async function buildRecalculateResponse(input: RecalculateRequest) {
  if (!parseDateOnly(input.date)) {
    return badRequest("Invalid date");
  }
  const jobIds = collectJobIds(input);
  if (hasDuplicates(jobIds)) {
    return badRequest("Duplicate job ids");
  }
  if (jobIds.length > MAX_RECALCULATE_JOBS) {
    return NextResponse.json(
      {
        error: "Too many jobs in scope",
        code: "TOO_MANY_JOBS",
        limit: MAX_RECALCULATE_JOBS,
      },
      { status: HTTP_PAYLOAD_TOO_LARGE }
    );
  }

  const routes = await resolveRoutes(input);
  if (!routes) {
    return badRequest("Unknown or inactive technician");
  }

  const config = await getRouteAssistantConfig();
  const technicians = routes.map((route) => route.technician);
  const [originGeocoded, { jobs }] = await Promise.all([
    geocodeAddresses([config.originAddress]),
    loadRouteAssistantJobsByIds(jobIds, technicians),
  ]);

  const loadedIds = new Set(jobs.map((job) => job.id));
  const missingJobIds = jobIds.filter((jobId) => !loadedIds.has(jobId));
  if (missingJobIds.length > 0) {
    return NextResponse.json(
      { error: "Jobs not found", code: "JOB_NOT_FOUND", jobIds: missingJobIds },
      { status: HTTP_NOT_FOUND }
    );
  }

  const plan = await buildFixedOrderPlan({
    routes,
    jobs,
    originAddress: config.originAddress,
    originCoordinates: originGeocoded.get(config.originAddress) ?? null,
  });

  return NextResponse.json({
    date: input.date,
    originAddress: config.originAddress,
    unresolvedJobIds: jobs.filter((job) => !job.coordinates).map((job) => job.id),
    plan,
  } satisfies AssistantRecalculateResponse);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_UNAUTHORIZED });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return badRequest("Invalid request data");
  }

  const rateLimit = await checkRateLimit({
    key: `route-assistant-recalculate:${session.sub}`,
    limit: RECALCULATE_RATE_LIMIT,
    windowMs: RECALCULATE_RATE_LIMIT_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: HTTP_TOO_MANY_REQUESTS }
    );
  }

  try {
    return await buildRecalculateResponse(parsed.data);
  } catch (error) {
    console.error("route-assistant recalculate: failed", {
      userId: session.sub,
      date: parsed.data.date,
      routes: parsed.data.routes.length,
      error,
    });
    return NextResponse.json(
      { error: "Failed to recalculate route plan" },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
