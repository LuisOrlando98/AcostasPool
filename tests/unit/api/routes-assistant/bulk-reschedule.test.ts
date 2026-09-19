/**
 * Tests de POST /api/routes/bulk-reschedule centrados en el estado resultante:
 * reordenar o reasignar dentro del mismo día de negocio NO puede degradar un
 * trabajo ON_THE_WAY o IN_PROGRESS (regla en @/lib/jobs/reschedule-status).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobStatus, Prisma } from "@prisma/client";
import { ADMIN_SESSION, postRequest, TECH_A, TECHNICIAN_SESSION } from "./fixtures";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

const dbMock = vi.hoisted(() => ({ jobFindMany: vi.fn() }));
const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }));
const lifecycleMock = vi.hoisted(() => ({ applyJobLifecycleUpdate: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { job: { findMany: dbMock.jobFindMany } } }));
vi.mock("@/lib/auth/session", () => sessionMock);
vi.mock("@/lib/jobs/lifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/lifecycle")>();
  return { ...actual, applyJobLifecycleUpdate: lifecycleMock.applyJobLifecycleUpdate };
});

import { POST } from "@/app/api/routes/bulk-reschedule/route";

const BULK_PATH = "/api/routes/bulk-reschedule";
/** 2026-09-21 09:00 en Nueva York (el "ahora" de todos estos tests). */
const NOW = new Date("2026-09-21T13:00:00.000Z");
const SAME_DAY_LATER = "2026-09-21T20:00:00.000Z";
const NEXT_WEEK = "2026-09-28T13:00:00.000Z";

function snapshot(overrides: { id: string; status: JobStatus; scheduledDate?: Date }) {
  return {
    id: overrides.id,
    scheduledDate: overrides.scheduledDate ?? NOW,
    technicianId: TECH_A.id,
    sortOrder: 540,
    status: overrides.status,
    priority: "NORMAL",
    serviceType: "WEEKLY_CLEANING",
    notes: null,
    customerNotes: null,
  };
}

function appliedStatus(callIndex = 0): JobStatus {
  const data = lifecycleMock.applyJobLifecycleUpdate.mock.calls[callIndex][0]
    .data as Prisma.JobUpdateInput;
  return data.status as JobStatus;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  sessionMock.getSession.mockResolvedValue(ADMIN_SESSION);
  dbMock.jobFindMany.mockResolvedValue([]);
  lifecycleMock.applyJobLifecycleUpdate.mockImplementation(
    async ({ jobId }: { jobId: string }) => ({
      ...snapshot({ id: jobId, status: "SCHEDULED" }),
      technician: null,
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST bulk-reschedule: autenticación y validación", () => {
  it("responde 401 sin sesión de administrador", async () => {
    sessionMock.getSession.mockResolvedValue(TECHNICIAN_SESSION);

    expect((await POST(postRequest(BULK_PATH, { updates: [] }))).status).toBe(401);
  });

  it("responde 400 cuando el cuerpo no valida", async () => {
    const response = await POST(postRequest(BULK_PATH, { updates: [{ sortOrder: 1 }] }));

    expect(response.status).toBe(400);
  });
});

describe("POST bulk-reschedule: estado tras el cambio", () => {
  it("conserva ON_THE_WAY al reordenar sin tocar la fecha", async () => {
    dbMock.jobFindMany.mockResolvedValue([snapshot({ id: "j1", status: "ON_THE_WAY" })]);

    const response = await POST(
      postRequest(BULK_PATH, { updates: [{ jobId: "j1", sortOrder: 620 }] })
    );

    expect(response.status).toBe(200);
    expect(appliedStatus()).toBe("ON_THE_WAY");
  });

  it("conserva IN_PROGRESS al mover a otra hora del mismo día", async () => {
    dbMock.jobFindMany.mockResolvedValue([snapshot({ id: "j1", status: "IN_PROGRESS" })]);

    await POST(
      postRequest(BULK_PATH, {
        updates: [{ jobId: "j1", scheduledDate: SAME_DAY_LATER, sortOrder: 960 }],
      })
    );

    expect(appliedStatus()).toBe("IN_PROGRESS");
  });

  it("conserva ON_THE_WAY al reasignar de técnico dentro del mismo día", async () => {
    dbMock.jobFindMany.mockResolvedValue([snapshot({ id: "j1", status: "ON_THE_WAY" })]);

    await POST(
      postRequest(BULK_PATH, {
        updates: [{ jobId: "j1", technicianId: "tech-b", sortOrder: 700 }],
      })
    );

    expect(appliedStatus()).toBe("ON_THE_WAY");
  });

  it("pasa a SCHEDULED al mover a un día futuro", async () => {
    dbMock.jobFindMany.mockResolvedValue([snapshot({ id: "j1", status: "IN_PROGRESS" })]);

    await POST(
      postRequest(BULK_PATH, { updates: [{ jobId: "j1", scheduledDate: NEXT_WEEK }] })
    );

    expect(appliedStatus()).toBe("SCHEDULED");
  });

  it("pasa a PENDING al traer un trabajo futuro al día de hoy", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      snapshot({
        id: "j1",
        status: "SCHEDULED",
        scheduledDate: new Date(NEXT_WEEK),
      }),
    ]);

    await POST(
      postRequest(BULK_PATH, {
        updates: [{ jobId: "j1", scheduledDate: NOW.toISOString() }],
      })
    );

    expect(appliedStatus()).toBe("PENDING");
  });

  it("nunca reabre un trabajo COMPLETED", async () => {
    dbMock.jobFindMany.mockResolvedValue([snapshot({ id: "j1", status: "COMPLETED" })]);

    await POST(
      postRequest(BULK_PATH, { updates: [{ jobId: "j1", scheduledDate: NEXT_WEEK }] })
    );

    expect(appliedStatus()).toBe("COMPLETED");
  });
});

describe("POST bulk-reschedule: resultado del lote", () => {
  it("omite los trabajos que ya no existen y aplica el resto", async () => {
    dbMock.jobFindMany.mockResolvedValue([snapshot({ id: "j1", status: "PENDING" })]);

    const response = await POST(
      postRequest(BULK_PATH, {
        updates: [
          { jobId: "j1", sortOrder: 600 },
          { jobId: "borrado", sortOrder: 610 },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      applied: ["j1"],
      skipped: ["borrado"],
      failed: [],
    });
  });

  it("devuelve 500 con el detalle de los fallos sin abortar el lote", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.jobFindMany.mockResolvedValue([
      snapshot({ id: "j1", status: "PENDING" }),
      snapshot({ id: "j2", status: "PENDING" }),
    ]);
    lifecycleMock.applyJobLifecycleUpdate
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        ...snapshot({ id: "j2", status: "PENDING" }),
        technician: null,
      });

    const response = await POST(
      postRequest(BULK_PATH, {
        updates: [
          { jobId: "j1", sortOrder: 600 },
          { jobId: "j2", sortOrder: 610 },
        ],
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false,
      applied: ["j2"],
      failed: [{ id: "j1", error: "boom" }],
    });
    consoleError.mockRestore();
  });
});
