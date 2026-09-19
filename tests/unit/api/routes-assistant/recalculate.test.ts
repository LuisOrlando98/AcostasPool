/**
 * Tests de POST /api/admin/routes/assistant/recalculate.
 * El recálculo respeta el orden recibido: lo que se comprueba aquí es la
 * validación de la petición, los errores del contrato y que el plan devuelto
 * conserva ese orden con la estrategia MANUAL.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantRecalculateResponse } from "@/lib/routing/assistant-types";
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
    job: { findMany: dbMock.jobFindMany },
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

import { POST } from "@/app/api/admin/routes/assistant/recalculate/route";

const RECALCULATE_PATH = "/api/admin/routes/assistant/recalculate";
const MAX_RECALCULATE_JOBS = 200;

function recalculateRequest(body: Record<string, unknown>) {
  return postRequest(RECALCULATE_PATH, { date: PLAN_DATE, ...body });
}

async function readPlan(response: Response) {
  return (await response.json()) as AssistantRecalculateResponse;
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
  dbMock.technicianFindMany.mockResolvedValue([technicianRow(TECH_A)]);
  dbMock.jobFindMany.mockResolvedValue([]);
});

describe("POST recalculate: autenticación y validación", () => {
  it("responde 401 sin sesión de administrador", async () => {
    sessionMock.getSession.mockResolvedValue(null);
    expect((await POST(recalculateRequest({ routes: [] }))).status).toBe(401);

    sessionMock.getSession.mockResolvedValue(TECHNICIAN_SESSION);
    expect((await POST(recalculateRequest({ routes: [] }))).status).toBe(401);
  });

  it("responde 400 cuando falta routes o la fecha no vale", async () => {
    expect((await POST(postRequest(RECALCULATE_PATH, { date: PLAN_DATE }))).status).toBe(400);
    expect((await POST(postRequest(RECALCULATE_PATH, { routes: [] }))).status).toBe(400);
    expect(
      (await POST(postRequest(RECALCULATE_PATH, { date: "2026-13-45", routes: [] }))).status
    ).toBe(400);
  });

  it("responde 400 cuando un trabajo aparece en dos rutas", async () => {
    dbMock.technicianFindMany.mockResolvedValue([
      technicianRow(TECH_A),
      technicianRow(TECH_B),
    ]);

    const response = await POST(
      recalculateRequest({
        routes: [
          { technicianId: TECH_A.id, jobIds: ["j1"] },
          { technicianId: TECH_B.id, jobIds: ["j1"] },
        ],
      })
    );

    expect(response.status).toBe(400);
  });

  it("responde 400 cuando un técnico no existe o no está activo", async () => {
    dbMock.technicianFindMany.mockResolvedValue([]);

    const response = await POST(
      recalculateRequest({ routes: [{ technicianId: "fantasma", jobIds: ["j1"] }] })
    );

    expect(response.status).toBe(400);
    expect(dbMock.jobFindMany).not.toHaveBeenCalled();
  });

  it("responde 413 cuando se superan los 200 trabajos", async () => {
    const jobIds = Array.from({ length: MAX_RECALCULATE_JOBS + 1 }, (_, i) => `job-${i}`);

    const response = await POST(
      recalculateRequest({ routes: [{ technicianId: TECH_A.id, jobIds }] })
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      code: "TOO_MANY_JOBS",
      limit: MAX_RECALCULATE_JOBS,
    });
  });

  it("responde 429 con su propia clave de rate limit", async () => {
    rateLimitMock.checkRateLimit.mockResolvedValue(BLOCKED_RATE_LIMIT);

    const response = await POST(recalculateRequest({ routes: [] }));

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "RATE_LIMITED" });
    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith({
      key: `route-assistant-recalculate:${ADMIN_SESSION.sub}`,
      limit: 20,
      windowMs: 5 * 60_000,
    });
  });
});

describe("POST recalculate: trabajos inexistentes", () => {
  it("responde 404 con JOB_NOT_FOUND y los ids que faltan", async () => {
    dbMock.jobFindMany.mockResolvedValue([jobRecord({ id: "j1", technicianId: TECH_A.id })]);

    const response = await POST(
      recalculateRequest({
        routes: [{ technicianId: TECH_A.id, jobIds: ["j1", "borrado", "tambien-borrado"] }],
      })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: expect.any(String),
      code: "JOB_NOT_FOUND",
      jobIds: ["borrado", "tambien-borrado"],
    });
  });
});

describe("POST recalculate: plan MANUAL", () => {
  it("conserva el orden recibido y devuelve updates coherentes", async () => {
    // La base de datos devuelve otro orden: manda el de la petición.
    dbMock.jobFindMany.mockResolvedValue([
      jobRecord({ id: "j1", technicianId: TECH_A.id }),
      jobRecord({ id: "j2", technicianId: TECH_A.id }),
      jobRecord({ id: "j3", technicianId: TECH_A.id }),
    ]);

    const body = await readPlan(
      await POST(
        recalculateRequest({
          routes: [{ technicianId: TECH_A.id, jobIds: ["j3", "j1", "j2"] }],
        })
      )
    );

    expect(body.date).toBe(PLAN_DATE);
    expect(body.originAddress).toBe(ORIGIN_ADDRESS);
    expect(body.plan.strategy).toBe("MANUAL");
    expect(body.plan.routes).toHaveLength(1);
    expect(body.plan.routes[0].stops.map((stop) => stop.jobId)).toEqual(["j3", "j1", "j2"]);
    expect(body.plan.routes[0].stops.map((stop) => stop.order)).toEqual([1, 2, 3]);
    expect(body.plan.updates.map((update) => update.jobId)).toEqual(["j3", "j1", "j2"]);
    expect(
      body.plan.updates.every((update) => update.technicianId === TECH_A.id)
    ).toBe(true);
    expect(body.unresolvedJobIds).toEqual(["j1", "j2", "j3"]);
    expect(dbMock.jobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["j3", "j1", "j2"] } }, take: 3 })
    );
  });

  it("solicita a travel solo los tramos consecutivos", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      jobRecord({ id: "j1", technicianId: TECH_A.id }),
      jobRecord({ id: "j2", technicianId: TECH_A.id }),
    ]);

    await POST(
      recalculateRequest({ routes: [{ technicianId: TECH_A.id, jobIds: ["j1", "j2"] }] })
    );

    expect(travelMock.getTravelMetricsForPairs).toHaveBeenCalledTimes(1);
    const pairs = travelMock.getTravelMetricsForPairs.mock.calls[0][0] as Array<{
      fromAddress: string;
      toAddress: string;
    }>;
    expect(pairs.map((pair) => [pair.fromAddress, pair.toAddress])).toEqual([
      [ORIGIN_ADDRESS, "Address j1"],
      ["Address j1", "Address j2"],
      ["Address j2", ORIGIN_ADDRESS],
    ]);
  });

  it("acepta una petición sin rutas y devuelve un plan vacío", async () => {
    const body = await readPlan(await POST(recalculateRequest({ routes: [] })));

    expect(body.plan.strategy).toBe("MANUAL");
    expect(body.plan.routes).toEqual([]);
    expect(body.plan.updates).toEqual([]);
    expect(dbMock.jobFindMany).not.toHaveBeenCalled();
  });

  it("responde 500 registrando el contexto cuando falla la carga", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.jobFindMany.mockRejectedValue(new Error("db down"));

    const response = await POST(
      recalculateRequest({ routes: [{ technicianId: TECH_A.id, jobIds: ["j1"] }] })
    );

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      "route-assistant recalculate: failed",
      expect.objectContaining({ userId: ADMIN_SESSION.sub, date: PLAN_DATE })
    );
    consoleError.mockRestore();
  });
});
