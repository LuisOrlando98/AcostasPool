import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// El módulo de zona horaria lee el entorno en tiempo de import.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

const dbMock = vi.hoisted(() => ({
  job: { count: vi.fn() },
}));
const notificationsMock = vi.hoisted(() => ({
  createNotification: vi.fn(),
  queueTechDigestItem: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: dbMock }));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: notificationsMock.createNotification,
}));
vi.mock("@/lib/notifications/techDigest", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/notifications/techDigest")>();
  return { ...original, queueTechDigestItem: notificationsMock.queueTechDigestItem };
});

import {
  AUTO_GENERATED_JOB_MARKER,
  UPCOMING_JOB_STATUSES,
  countUpcomingPlanJobs,
  deleteUpcomingPlanJobs,
  materializeServicePlanJob,
  queueJobScheduledNotifications,
  type MaterializablePlan,
  type MaterializeDb,
  type MaterializedJob,
} from "@/lib/jobs/materialize";

/** Lunes 15 de junio de 2026, 10:30 EDT. */
const NOW = new Date("2026-06-15T14:30:00Z");
/** Inicio del día de negocio de NOW (00:00 EDT). */
const TODAY_START = new Date("2026-06-15T04:00:00Z");
/** Ocurrencia de hoy a las 09:00 EDT. */
const TODAY_9AM = new Date("2026-06-15T13:00:00Z");
/** Lunes anterior a las 09:00 EDT (dos semanas atrás). */
const TWO_WEEKS_AGO_9AM = new Date("2026-06-01T13:00:00Z");
/** Lunes siguiente a las 09:00 EDT. */
const NEXT_MONDAY_9AM = new Date("2026-06-22T13:00:00Z");
/** Rango del día de ruta del lunes siguiente (00:00 a 23:59:59.999 EDT). */
const NEXT_MONDAY_ROUTE_START = new Date("2026-06-22T04:00:00Z");
const NEXT_MONDAY_ROUTE_END = new Date("2026-06-23T03:59:59.999Z");
/** Dos lunes después a las 09:00 EDT. */
const IN_TWO_WEEKS_9AM = new Date("2026-06-29T13:00:00Z");
const NINE_AM_SORT_ORDER = 9 * 60;
const PLAN_ID = "plan_1";
const TIER_ID = "tier_plan";
const FALLBACK_TIER_ID = "tier_default";
const JOB_ID = "job_1";
const TECHNICIAN_ID = "tech_1";
const OTHER_JOBS_TODAY = 2;
const DELETED_COUNT = 4;

function buildPlan(overrides: Partial<MaterializablePlan> = {}): MaterializablePlan {
  return {
    id: PLAN_ID,
    customerId: "customer_1",
    propertyId: "property_1",
    technicianId: TECHNICIAN_ID,
    serviceTierId: TIER_ID,
    serviceType: "WEEKLY_CLEANING",
    priority: "NORMAL",
    frequency: "WEEKLY",
    nextRunAt: NEXT_MONDAY_9AM,
    estimatedDurationMinutes: 45,
    checklist: [{ label: "Plan checklist item", completed: false }],
    notes: null,
    isActive: true,
    customer: { estadoCuenta: "ACTIVE", pauseServicesFrom: null },
    ...overrides,
  };
}

function buildDb() {
  const db = {
    job: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    serviceTier: {
      findUnique: vi.fn().mockResolvedValue({
        id: TIER_ID,
        checklist: ["Skim surface", { label: "Brush walls" }, { label: "" }],
      }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    servicePlan: { update: vi.fn() },
  };
  db.job.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: JOB_ID,
    ...data,
    customer: { nombre: "Ana", apellidos: "Perez", email: "ana@example.com" },
    property: { address: "123 Main St" },
  }));
  return db;
}

type Db = ReturnType<typeof buildDb>;

const asDb = (db: Db) => db as unknown as MaterializeDb;

function createdJobData(db: Db) {
  return db.job.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
}

function buildMaterializedJob(overrides: Partial<MaterializedJob> = {}): MaterializedJob {
  return {
    id: JOB_ID,
    customerId: "customer_1",
    propertyId: "property_1",
    technicianId: TECHNICIAN_ID,
    scheduledDate: NEXT_MONDAY_9AM,
    customer: { nombre: "Ana", apellidos: "Perez", email: "ana@example.com" },
    property: { address: "123 Main St" },
    ...overrides,
  } as MaterializedJob;
}

let db: Db;

beforeEach(() => {
  db = buildDb();
  dbMock.job.count.mockReset();
  notificationsMock.createNotification.mockReset();
  notificationsMock.queueTechDigestItem.mockReset();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("materializeServicePlanJob", () => {
  it("devuelve null sin consultar la BD cuando el plan está inactivo", async () => {
    // Arrange
    const plan = buildPlan({ isActive: false });

    // Act
    const job = await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    expect(job).toBeNull();
    expect(db.job.findFirst).not.toHaveBeenCalled();
    expect(db.job.create).not.toHaveBeenCalled();
  });

  it("devuelve null cuando el cliente no está activo (criterio del worker)", async () => {
    // Arrange
    const plan = buildPlan({ customer: { estadoCuenta: "INACTIVE", pauseServicesFrom: null } });

    // Act
    const job = await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    expect(job).toBeNull();
    expect(db.job.create).not.toHaveBeenCalled();
  });

  it("devuelve null cuando la ocurrencia cae en o después de la pausa de servicios", async () => {
    // Arrange
    const plan = buildPlan({
      customer: { estadoCuenta: "ACTIVE", pauseServicesFrom: NEXT_MONDAY_9AM },
    });

    // Act
    const job = await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    expect(job).toBeNull();
    expect(db.job.create).not.toHaveBeenCalled();
  });

  it("crea la visita cuando la pausa empieza después de la ocurrencia", async () => {
    // Arrange
    const plan = buildPlan({
      customer: { estadoCuenta: "ACTIVE", pauseServicesFrom: IN_TWO_WEEKS_9AM },
    });

    // Act
    const job = await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    expect(job?.id).toBe(JOB_ID);
    expect(createdJobData(db).scheduledDate).toEqual(NEXT_MONDAY_9AM);
  });

  it("devuelve null cuando nextRunAt no es una fecha válida", async () => {
    // Arrange
    const plan = buildPlan({ nextRunAt: new Date(Number.NaN) });

    // Act
    const job = await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    expect(job).toBeNull();
    expect(db.job.findFirst).not.toHaveBeenCalled();
  });

  it("no duplica la visita si ya existe un trabajo del plan en esa fecha", async () => {
    // Arrange
    db.job.findFirst.mockResolvedValue({ id: "existing_job" });
    const plan = buildPlan();

    // Act
    const job = await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    expect(job).toBeNull();
    expect(db.job.findFirst).toHaveBeenCalledWith({
      where: { planId: PLAN_ID, scheduledDate: NEXT_MONDAY_9AM },
      select: { id: true },
    });
    expect(db.job.create).not.toHaveBeenCalled();
  });

  it("avanza las ocurrencias pasadas hasta la primera de hoy y la deja PENDING", async () => {
    // Arrange
    const plan = buildPlan({ nextRunAt: TWO_WEEKS_AGO_9AM });

    // Act
    const job = await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    const data = createdJobData(db);
    expect(job?.id).toBe(JOB_ID);
    expect(data.scheduledDate).toEqual(TODAY_9AM);
    expect(data.scheduledDate).not.toEqual(TODAY_START);
    expect(data.status).toBe("PENDING");
    expect(data.sortOrder).toBe(NINE_AM_SORT_ORDER);
  });

  it("crea una visita futura SCHEDULED con los datos del plan, notas marcadas y checklist normalizado", async () => {
    // Arrange
    const plan = buildPlan({ notes: "Gate code 1234" });

    // Act
    const job = await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    expect(job?.id).toBe(JOB_ID);
    expect(createdJobData(db)).toEqual({
      customerId: "customer_1",
      propertyId: "property_1",
      technicianId: TECHNICIAN_ID,
      serviceTierId: TIER_ID,
      scheduledDate: NEXT_MONDAY_9AM,
      sortOrder: NINE_AM_SORT_ORDER,
      status: "SCHEDULED",
      type: "ROUTINE",
      priority: "NORMAL",
      serviceType: "WEEKLY_CLEANING",
      estimatedDurationMinutes: 45,
      checklist: [
        { label: "Skim surface", completed: false },
        { label: "Brush walls", completed: false },
      ],
      notes: `Gate code 1234\n${AUTO_GENERATED_JOB_MARKER}`,
      planId: PLAN_ID,
      requestedAt: NOW,
    });
    expect(db.job.create.mock.calls[0][0].include).toEqual({ customer: true, property: true });
    expect(db.servicePlan.update).not.toHaveBeenCalled();
  });

  it("usa solo la marca como notas cuando el plan no tiene notas", async () => {
    // Arrange
    const plan = buildPlan({ notes: null });

    // Act
    await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    expect(createdJobData(db).notes).toBe(AUTO_GENERATED_JOB_MARKER);
  });

  it("respeta una fecha explícita sin avanzarla y adelanta el plan cuando se pide", async () => {
    // Arrange
    const plan = buildPlan({ nextRunAt: NEXT_MONDAY_9AM });

    // Act
    const job = await materializeServicePlanJob(asDb(db), plan, {
      now: NOW,
      scheduledDate: TODAY_9AM,
      advancePlan: true,
    });

    // Assert
    expect(job?.id).toBe(JOB_ID);
    expect(createdJobData(db).scheduledDate).toEqual(TODAY_9AM);
    expect(createdJobData(db).status).toBe("PENDING");
    expect(db.servicePlan.update).toHaveBeenCalledWith({
      where: { id: PLAN_ID },
      data: { nextRunAt: NEXT_MONDAY_9AM },
    });
  });

  it("adelanta nextRunAt una frecuencia más allá de la ocurrencia materializada", async () => {
    // Arrange
    const plan = buildPlan({ nextRunAt: TWO_WEEKS_AGO_9AM, frequency: "BIWEEKLY" });

    // Act
    await materializeServicePlanJob(asDb(db), plan, { now: NOW, advancePlan: true });

    // Assert
    expect(createdJobData(db).scheduledDate).toEqual(TODAY_9AM);
    expect(db.servicePlan.update).toHaveBeenCalledWith({
      where: { id: PLAN_ID },
      data: { nextRunAt: IN_TWO_WEEKS_9AM },
    });
  });

  it("cae al primer nivel de servicio activo cuando el plan no tiene nivel", async () => {
    // Arrange
    db.serviceTier.findFirst.mockResolvedValueOnce({
      id: FALLBACK_TIER_ID,
      checklist: [{ label: "Default item" }],
    });
    const plan = buildPlan({ serviceTierId: null });

    // Act
    await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    expect(db.serviceTier.findUnique).not.toHaveBeenCalled();
    expect(db.serviceTier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    );
    expect(createdJobData(db).serviceTierId).toBe(FALLBACK_TIER_ID);
    expect(createdJobData(db).checklist).toEqual([{ label: "Default item", completed: false }]);
  });

  it("usa el checklist del plan cuando no existe ningún nivel de servicio", async () => {
    // Arrange
    db.serviceTier.findUnique.mockResolvedValue(null);
    db.serviceTier.findFirst.mockResolvedValue(null);
    const plan = buildPlan();

    // Act
    await materializeServicePlanJob(asDb(db), plan, { now: NOW });

    // Assert
    expect(createdJobData(db).serviceTierId).toBeNull();
    expect(createdJobData(db).checklist).toEqual([
      { label: "Plan checklist item", completed: false },
    ]);
  });
});

describe("queueJobScheduledNotifications", () => {
  it("encola ROUTE_ASSIGNED cuando el técnico no tenía más visitas ese día", async () => {
    // Arrange
    dbMock.job.count.mockResolvedValue(0);
    const job = buildMaterializedJob();

    // Act
    await queueJobScheduledNotifications(job);

    // Assert
    expect(dbMock.job.count).toHaveBeenCalledWith({
      where: {
        technicianId: TECHNICIAN_ID,
        scheduledDate: { gte: NEXT_MONDAY_ROUTE_START, lte: NEXT_MONDAY_ROUTE_END },
        NOT: { id: JOB_ID },
      },
    });
    expect(notificationsMock.queueTechDigestItem).toHaveBeenCalledWith({
      technicianId: TECHNICIAN_ID,
      jobId: JOB_ID,
      routeDate: NEXT_MONDAY_9AM,
      changeType: "ROUTE_ASSIGNED",
      payload: {
        scheduledDate: NEXT_MONDAY_9AM.toISOString(),
        customerName: "Ana Perez",
        address: "123 Main St",
      },
    });
    expect(notificationsMock.createNotification).toHaveBeenCalledWith({
      customerId: "customer_1",
      recipientRole: "CUSTOMER",
      eventType: "SERVICE_SCHEDULED",
      severity: "INFO",
      payload: {
        jobId: JOB_ID,
        technicianId: TECHNICIAN_ID,
        scheduledDate: NEXT_MONDAY_9AM.toISOString(),
      },
    });
  });

  it("encola JOB_ASSIGNED cuando el técnico ya tenía visitas ese día", async () => {
    // Arrange
    dbMock.job.count.mockResolvedValue(OTHER_JOBS_TODAY);

    // Act
    await queueJobScheduledNotifications(buildMaterializedJob());

    // Assert
    expect(notificationsMock.queueTechDigestItem).toHaveBeenCalledWith(
      expect.objectContaining({ changeType: "JOB_ASSIGNED" })
    );
  });

  it("solo notifica al cliente cuando no hay técnico asignado", async () => {
    // Act
    await queueJobScheduledNotifications(buildMaterializedJob({ technicianId: null }));

    // Assert
    expect(dbMock.job.count).not.toHaveBeenCalled();
    expect(notificationsMock.queueTechDigestItem).not.toHaveBeenCalled();
    expect(notificationsMock.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ technicianId: null }) })
    );
  });
});

describe("visitas pendientes de un plan", () => {
  const expectedWhere = {
    planId: PLAN_ID,
    scheduledDate: { gte: TODAY_START },
    status: { in: [...UPCOMING_JOB_STATUSES] },
  };

  it("countUpcomingPlanJobs cuenta desde el inicio del día de negocio", async () => {
    // Arrange
    db.job.count.mockResolvedValue(OTHER_JOBS_TODAY);

    // Act
    const count = await countUpcomingPlanJobs(asDb(db), PLAN_ID, NOW);

    // Assert
    expect(count).toBe(OTHER_JOBS_TODAY);
    expect(db.job.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("deleteUpcomingPlanJobs borra solo las visitas pendientes y devuelve el número", async () => {
    // Arrange
    db.job.deleteMany.mockResolvedValue({ count: DELETED_COUNT });

    // Act
    const deleted = await deleteUpcomingPlanJobs(asDb(db), PLAN_ID, NOW);

    // Assert
    expect(deleted).toBe(DELETED_COUNT);
    expect(db.job.deleteMany).toHaveBeenCalledWith({ where: expectedWhere });
  });
});
