/**
 * Tests de POST /api/admin/routes/assistant/plan.
 * Se mockean la sesión, prisma, el rate limit, la geocodificación y las
 * métricas de travel: aquí se verifica el contrato del endpoint (validación,
 * límites, alcance y forma de la respuesta), no la heurística del planner.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantPlanResponse } from "@/lib/routing/assistant-types";
import {
  ADMIN_SESSION,
  ALLOWED_RATE_LIMIT,
  BLOCKED_RATE_LIMIT,
  jobRecord,
  ORIGIN_ADDRESS,
  PLAN_DATE,
  postRequest,
  TECH_A,
  TECH_B,
  TECHNICIAN_SESSION,
  technicianRow,
} from "./fixtures";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

const dbMock = vi.hoisted(() => ({
  jobFindMany: vi.fn(),
  jobCount: vi.fn(),
  technicianFindMany: vi.fn(),
}));
const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }));
const rateLimitMock = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const geoMock = vi.hoisted(() => ({
  geocodeAddresses: vi.fn(),
  geocodeProperties: vi.fn(),
}));
const travelMock = vi.hoisted(() => ({ getTravelMetricsForPairs: vi.fn() }));
const settingsMock = vi.hoisted(() => ({ getRouteAssistantConfig: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    job: { findMany: dbMock.jobFindMany, count: dbMock.jobCount },
    technician: { findMany: dbMock.technicianFindMany },
  },
}));
vi.mock("@/lib/auth/session", () => sessionMock);
vi.mock("@/lib/security/rate-limit", () => rateLimitMock);
vi.mock("@/lib/routing/geo", () => geoMock);
vi.mock("@/lib/routing/travel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/routing/travel")>();
  return { ...actual, getTravelMetricsForPairs: travelMock.getTravelMetricsForPairs };
});
vi.mock("@/lib/site-settings", () => settingsMock);

import { GLOBAL_RECURRING_PLAN_OPTIONS } from "@/lib/jobs/recurring-plan-templates";
import { POST } from "@/app/api/admin/routes/assistant/plan/route";

const PLAN_PATH = "/api/admin/routes/assistant/plan";
const GLOBAL_PLAN = GLOBAL_RECURRING_PLAN_OPTIONS[0];
const MAX_PLAN_JOBS = 200;

function planRequest(body: Record<string, unknown> = {}) {
  return postRequest(PLAN_PATH, { date: PLAN_DATE, ...body });
}

async function readPlan(response: Response) {
  return (await response.json()) as AssistantPlanResponse;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.getSession.mockResolvedValue(ADMIN_SESSION);
  rateLimitMock.checkRateLimit.mockResolvedValue(ALLOWED_RATE_LIMIT);
  settingsMock.getRouteAssistantConfig.mockResolvedValue({
    dailyAutoOptimizeEnabled: false,
    originAddress: ORIGIN_ADDRESS,
  });
  geoMock.geocodeAddresses.mockResolvedValue(new Map());
  geoMock.geocodeProperties.mockResolvedValue(new Map());
  travelMock.getTravelMetricsForPairs.mockResolvedValue(new Map());
  dbMock.technicianFindMany.mockResolvedValue([technicianRow(TECH_A), technicianRow(TECH_B)]);
  dbMock.jobFindMany.mockResolvedValue([]);
  dbMock.jobCount.mockResolvedValue(0);
});

describe("POST plan: autenticación y validación", () => {
  it("responde 401 sin sesión", async () => {
    sessionMock.getSession.mockResolvedValue(null);

    const response = await POST(planRequest());

    expect(response.status).toBe(401);
    expect(rateLimitMock.checkRateLimit).not.toHaveBeenCalled();
  });

  it("responde 401 a un rol que no es ADMIN", async () => {
    sessionMock.getSession.mockResolvedValue(TECHNICIAN_SESSION);

    expect((await POST(planRequest())).status).toBe(401);
  });

  it("responde 400 cuando la fecha falta o no tiene el formato esperado", async () => {
    expect((await POST(postRequest(PLAN_PATH, {}))).status).toBe(400);
    expect((await POST(postRequest(PLAN_PATH, { date: "21-09-2026" }))).status).toBe(400);
  });

  it("responde 400 ante campos desconocidos del contrato anterior", async () => {
    const response = await POST(planRequest({ ignoreDate: true }));

    expect(response.status).toBe(400);
  });

  it("responde 400 cuando el plan recurrente no existe", async () => {
    const response = await POST(planRequest({ planTemplate: "no-existe" }));

    expect(response.status).toBe(400);
  });
});

describe("POST plan: rate limit", () => {
  it("responde 429 con el código RATE_LIMITED usando la clave del usuario", async () => {
    rateLimitMock.checkRateLimit.mockResolvedValue(BLOCKED_RATE_LIMIT);

    const response = await POST(planRequest());

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "RATE_LIMITED" });
    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith({
      key: `route-assistant-plan:${ADMIN_SESSION.sub}`,
      limit: 20,
      windowMs: 5 * 60_000,
    });
  });
});

describe("POST plan: alcance y límites", () => {
  it("responde 413 con TOO_MANY_JOBS cuando se superan los 200 trabajos", async () => {
    const records = Array.from({ length: MAX_PLAN_JOBS + 1 }, (_, index) =>
      jobRecord({ id: `job-${index}`, technicianId: TECH_A.id })
    );
    dbMock.jobFindMany.mockResolvedValue(records);
    dbMock.jobCount.mockResolvedValue(records.length);

    const response = await POST(planRequest());

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: expect.any(String),
      code: "TOO_MANY_JOBS",
      limit: MAX_PLAN_JOBS,
    });
  });

  it("consulta solo el día pedido, sin el margen de un día del contrato anterior", async () => {
    await POST(planRequest());

    const where = dbMock.jobFindMany.mock.calls[0][0].where as {
      scheduledDate: { gte: Date; lte: Date };
    };
    expect(where.scheduledDate.gte.toISOString()).toBe("2026-09-21T04:00:00.000Z");
    expect(where.scheduledDate.lte.toISOString()).toBe("2026-09-22T03:59:59.999Z");
  });

  it("devuelve una respuesta vacía cuando no hay técnicos activos", async () => {
    dbMock.technicianFindMany.mockResolvedValue([]);

    const body = await readPlan(await POST(planRequest()));

    expect(body).toEqual({
      date: PLAN_DATE,
      originAddress: ORIGIN_ADDRESS,
      technicians: [],
      jobsCount: 0,
      excludedCount: 0,
      unresolvedGeocodes: 0,
      unresolvedJobIds: [],
      plans: [],
    });
    expect(dbMock.jobFindMany).not.toHaveBeenCalled();
  });
});

describe("POST plan: respuesta", () => {
  it("devuelve el origen configurado, el alcance y un plan por estrategia", async () => {
    const records = [
      jobRecord({ id: "j1", technicianId: TECH_A.id }),
      jobRecord({ id: "j2", technicianId: TECH_B.id }),
    ];
    dbMock.jobFindMany.mockResolvedValue(records);
    dbMock.jobCount.mockResolvedValue(records.length);

    const body = await readPlan(await POST(planRequest()));

    expect(body.date).toBe(PLAN_DATE);
    expect(body.originAddress).toBe(ORIGIN_ADDRESS);
    expect(body.technicians).toEqual([TECH_A, TECH_B]);
    expect(body.jobsCount).toBe(2);
    expect(body.excludedCount).toBe(0);
    expect(body.unresolvedGeocodes).toBe(2);
    expect(body.unresolvedJobIds).toEqual(["j1", "j2"]);
    expect(body.plans.map((plan) => plan.strategy)).toEqual([
      "BALANCED",
      "SHORT_DRIVE",
      "KEEP_ASSIGNMENTS",
    ]);
    expect(body.plans[0].routes[0].stops[0]).toMatchObject({
      jobId: expect.any(String),
      serviceStartTime: expect.stringMatching(/^\d{2}:\d{2}$/),
      estimatedArrivalTime: expect.stringMatching(/^\d{2}:\d{2}$/),
      status: "SCHEDULED",
      hasCoordinates: false,
    });
    expect(body.plans[0].unassigned).toEqual([]);
  });

  it("con un solo técnico en alcance ofrece solo SHORT_DRIVE", async () => {
    dbMock.technicianFindMany.mockResolvedValue([technicianRow(TECH_A)]);
    dbMock.jobFindMany.mockResolvedValue([jobRecord({ id: "j1", technicianId: TECH_A.id })]);
    dbMock.jobCount.mockResolvedValue(1);

    const body = await readPlan(await POST(planRequest({ technicianIds: [TECH_A.id] })));

    expect(body.plans.map((plan) => plan.strategy)).toEqual(["SHORT_DRIVE"]);
    expect(dbMock.technicianFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user: { isActive: true }, id: { in: [TECH_A.id] } },
      })
    );
  });

  it("sin plan seleccionado incluye los trabajos bajo demanda y los de cualquier plan", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      jobRecord({ id: "ondemand", technicianId: TECH_A.id }),
      jobRecord({
        id: "weekly",
        technicianId: TECH_B.id,
        plan: { id: "plan-1", name: GLOBAL_PLAN.name, technicianId: TECH_B.id },
      }),
    ]);
    dbMock.jobCount.mockResolvedValue(2);

    const body = await readPlan(await POST(planRequest({ planTemplate: null })));

    expect(body.jobsCount).toBe(2);
    expect(body.excludedCount).toBe(0);
  });

  it("con un plan seleccionado excluye el resto y lo cuenta en excludedCount", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      jobRecord({ id: "ondemand", technicianId: TECH_A.id }),
      jobRecord({
        id: "weekly",
        technicianId: TECH_B.id,
        plan: { id: "plan-1", name: GLOBAL_PLAN.name, technicianId: TECH_B.id },
      }),
    ]);
    dbMock.jobCount.mockResolvedValue(2);

    const body = await readPlan(await POST(planRequest({ planTemplate: GLOBAL_PLAN.value })));

    expect(body.jobsCount).toBe(1);
    expect(body.excludedCount).toBe(1);
  });

  it("includeUnassigned false deja fuera los trabajos sin técnico", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      jobRecord({ id: "assigned", technicianId: TECH_A.id }),
      jobRecord({ id: "orphan" }),
    ]);
    dbMock.jobCount.mockResolvedValue(2);

    const included = await readPlan(await POST(planRequest({ includeUnassigned: true })));
    const excluded = await readPlan(await POST(planRequest({ includeUnassigned: false })));

    expect(included.jobsCount).toBe(2);
    expect(included.excludedCount).toBe(0);
    expect(excluded.jobsCount).toBe(1);
    expect(excluded.excludedCount).toBe(1);
  });

  it("filtra por cliente o dirección con addressQuery", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      jobRecord({ id: "match", technicianId: TECH_A.id }),
      jobRecord({ id: "other", technicianId: TECH_A.id }),
    ]);
    dbMock.jobCount.mockResolvedValue(2);

    const body = await readPlan(await POST(planRequest({ addressQuery: "Address match" })));

    expect(body.jobsCount).toBe(1);
    expect(body.excludedCount).toBe(1);
  });

  it("responde 500 registrando el contexto cuando falla la planificación", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.jobFindMany.mockRejectedValue(new Error("db down"));

    const response = await POST(planRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(consoleError).toHaveBeenCalledWith(
      "route-assistant plan: failed",
      expect.objectContaining({ userId: ADMIN_SESSION.sub, date: PLAN_DATE })
    );
    consoleError.mockRestore();
  });
});
