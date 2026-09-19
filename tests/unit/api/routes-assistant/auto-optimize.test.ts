/**
 * Tests de POST /api/internal/routes/assistant/auto-optimize (revisión diaria).
 * La autenticación por secreto de cron se cubre en tests/unit/security; aquí se
 * verifican el resumen { applied, failed }, la tolerancia a fallos por trabajo,
 * la fila de auditoría de sistema y que no se auto-asignan huérfanos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jobRecord, ORIGIN_ADDRESS, SCHEDULED_AT, TECH_A, technicianRow } from "./fixtures";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

const dbMock = vi.hoisted(() => ({
  jobFindMany: vi.fn(),
  technicianFindMany: vi.fn(),
  auditLogCreate: vi.fn(),
}));
const settingsMock = vi.hoisted(() => ({ getRouteAssistantConfig: vi.fn() }));
const geoMock = vi.hoisted(() => ({
  geocodeAddresses: vi.fn(),
  geocodeProperties: vi.fn(),
}));
const travelMock = vi.hoisted(() => ({ getTravelMetricsForPairs: vi.fn() }));
const lifecycleMock = vi.hoisted(() => ({ applyJobLifecycleUpdate: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    job: { findMany: dbMock.jobFindMany },
    technician: { findMany: dbMock.technicianFindMany },
    auditLog: { create: dbMock.auditLogCreate },
  },
}));
vi.mock("@/lib/site-settings", () => settingsMock);
vi.mock("@/lib/routing/geo", () => geoMock);
vi.mock("@/lib/routing/travel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/routing/travel")>();
  return { ...actual, getTravelMetricsForPairs: travelMock.getTravelMetricsForPairs };
});
vi.mock("@/lib/jobs/lifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/lifecycle")>();
  return { ...actual, applyJobLifecycleUpdate: lifecycleMock.applyJobLifecycleUpdate };
});

import { POST } from "@/app/api/internal/routes/assistant/auto-optimize/route";

const OPTIMIZE_URL = "http://localhost/api/internal/routes/assistant/auto-optimize";
const CRON_SECRET = "cron-secret-value";
/** Lunes: el plan recurrente global de ese día es "Monday Plan". */
const MONDAY = "2026-09-21";
const MONDAY_PLAN_NAME = "Monday Plan";

function optimizeRequest(body: Record<string, unknown> = { date: MONDAY }) {
  return new Request(OPTIMIZE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET },
    body: JSON.stringify(body),
  });
}

function planJobRecord(id: string, technicianId: string | null) {
  return jobRecord({
    id,
    technicianId,
    scheduledDate: SCHEDULED_AT,
    plan: { id: "plan-monday", name: MONDAY_PLAN_NAME, technicianId },
  });
}

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  settingsMock.getRouteAssistantConfig.mockResolvedValue({
    dailyAutoOptimizeEnabled: true,
    originAddress: ORIGIN_ADDRESS,
  });
  geoMock.geocodeAddresses.mockResolvedValue(new Map());
  geoMock.geocodeProperties.mockResolvedValue(new Map());
  travelMock.getTravelMetricsForPairs.mockResolvedValue(new Map());
  dbMock.technicianFindMany.mockResolvedValue([technicianRow(TECH_A)]);
  dbMock.auditLogCreate.mockResolvedValue({ id: "audit-1" });
  dbMock.jobFindMany.mockResolvedValue([]);
  lifecycleMock.applyJobLifecycleUpdate.mockResolvedValue({ id: "job" });
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
    return;
  }
  process.env.CRON_SECRET = originalSecret;
});

describe("auto-optimize: cortocircuitos", () => {
  it("se salta la pasada cuando la revisión automática está desactivada", async () => {
    settingsMock.getRouteAssistantConfig.mockResolvedValue({
      dailyAutoOptimizeEnabled: false,
      originAddress: ORIGIN_ADDRESS,
    });

    const response = await POST(optimizeRequest());

    expect(await response.json()).toEqual({ ok: true, skipped: true, reason: "disabled" });
    expect(dbMock.jobFindMany).not.toHaveBeenCalled();
  });

  it("se salta la pasada cuando el día no tiene trabajos del plan", async () => {
    const response = await POST(optimizeRequest());

    expect(await response.json()).toMatchObject({ skipped: true, reason: "no-jobs" });
    expect(dbMock.auditLogCreate).not.toHaveBeenCalled();
  });

  it("consulta solo el día pedido y el plan recurrente de ese día", async () => {
    await POST(optimizeRequest());

    const where = dbMock.jobFindMany.mock.calls[0][0].where as {
      scheduledDate: { gte: Date; lte: Date };
      plan: { is: { name: string } };
    };
    expect(where.plan.is.name).toBe(MONDAY_PLAN_NAME);
    expect(where.scheduledDate.gte.toISOString()).toBe("2026-09-21T04:00:00.000Z");
    expect(where.scheduledDate.lte.toISOString()).toBe("2026-09-22T03:59:59.999Z");
  });
});

describe("auto-optimize: aplicación y resumen", () => {
  it("aplica los reordenamientos, resume el resultado y audita la pasada", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      planJobRecord("j1", TECH_A.id),
      planJobRecord("j2", TECH_A.id),
    ]);

    const response = await POST(optimizeRequest());
    const body = await response.json();

    expect(body).toMatchObject({
      ok: true,
      date: MONDAY,
      planName: MONDAY_PLAN_NAME,
      applied: 2,
      failed: 0,
      skippedUpdates: 0,
      unassignedCount: 0,
    });
    expect(lifecycleMock.applyJobLifecycleUpdate).toHaveBeenCalledTimes(2);
    expect(lifecycleMock.applyJobLifecycleUpdate.mock.calls[0][0]).toMatchObject({
      actorUserId: null,
      data: { technician: { connect: { id: TECH_A.id } } },
    });
    expect(dbMock.auditLogCreate).toHaveBeenCalledWith({
      data: {
        action: "ROUTE_ASSISTANT_AUTO_OPTIMIZE",
        entity: "Job",
        metadata: {
          date: MONDAY,
          planName: MONDAY_PLAN_NAME,
          applied: 2,
          failed: 0,
          skipped: 0,
        },
      },
    });
    expect(dbMock.auditLogCreate.mock.calls[0][0].data).not.toHaveProperty("userId");
  });

  it("un trabajo que falla no tumba la pasada y queda contado en failed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.jobFindMany.mockResolvedValue([
      planJobRecord("j1", TECH_A.id),
      planJobRecord("j2", TECH_A.id),
    ]);
    lifecycleMock.applyJobLifecycleUpdate
      .mockRejectedValueOnce(new Error("job borrado"))
      .mockResolvedValueOnce({ id: "j2" });

    const body = await (await POST(optimizeRequest())).json();

    expect(body).toMatchObject({ ok: false, applied: 1, failed: 1 });
    expect(dbMock.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ applied: 1, failed: 1 }),
        }),
      })
    );
    expect(consoleError).toHaveBeenCalledWith(
      "route-assistant auto-optimize: job update failed",
      expect.objectContaining({ jobId: "j1" })
    );
    consoleError.mockRestore();
  });

  it("no auto-asigna los trabajos huérfanos del plan", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      planJobRecord("assigned", TECH_A.id),
      planJobRecord("orphan", null),
    ]);

    const body = await (await POST(optimizeRequest())).json();

    expect(body).toMatchObject({ applied: 1, unassignedCount: 1 });
    expect(lifecycleMock.applyJobLifecycleUpdate).toHaveBeenCalledTimes(1);
    expect(lifecycleMock.applyJobLifecycleUpdate.mock.calls[0][0]).toMatchObject({
      jobId: "assigned",
    });
  });

  it("usa la dirección de origen de la configuración", async () => {
    dbMock.jobFindMany.mockResolvedValue([planJobRecord("j1", TECH_A.id)]);

    await POST(optimizeRequest());

    expect(geoMock.geocodeAddresses).toHaveBeenCalledWith([ORIGIN_ADDRESS]);
    const pairs = travelMock.getTravelMetricsForPairs.mock.calls[0][0] as Array<{
      fromAddress: string;
    }>;
    expect(pairs[0].fromAddress).toBe(ORIGIN_ADDRESS);
  });
});
