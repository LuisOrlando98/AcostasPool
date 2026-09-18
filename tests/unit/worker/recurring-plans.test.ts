import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

const materializeMocks = vi.hoisted(() => ({
  queueJobScheduledNotifications: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/mail/transport", () => ({ sendMailAndLog: vi.fn() }));
// La materialización real corre contra el db inyectado; solo se aísla la publicación de avisos.
vi.mock("@/lib/jobs/materialize", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/jobs/materialize")>();
  return {
    ...original,
    queueJobScheduledNotifications: materializeMocks.queueJobScheduledNotifications,
  };
});

import type { MaterializablePlan } from "@/lib/jobs/materialize";
import { RECURRING_LOOKAHEAD_DAYS } from "@/lib/worker/constants";
import {
  listPlanOccurrences,
  processRecurringPlans,
  resolvePlanHorizon,
} from "@/lib/worker/recurring-plans";
import { asWorkerDb, createLoggerStub } from "./helpers";

/** Jueves 17 de septiembre de 2026, 10:00 EDT. */
const NOW = new Date("2026-09-17T14:00:00.000Z");
/** Jueves anterior a las 09:00 EDT: ya pasó, el plan debe avanzar. */
const LAST_THURSDAY_9AM = new Date("2026-09-10T13:00:00.000Z");
/** Ocurrencias semanales dentro de los 28 días: hoy y los cuatro jueves siguientes. */
const OCCURRENCES = [
  "2026-09-17T13:00:00.000Z",
  "2026-09-24T13:00:00.000Z",
  "2026-10-01T13:00:00.000Z",
  "2026-10-08T13:00:00.000Z",
  "2026-10-15T13:00:00.000Z",
].map((iso) => new Date(iso));
const NEXT_RUN_AFTER_HORIZON = new Date("2026-10-22T13:00:00.000Z");
const PAUSE_FROM = new Date("2026-10-01T04:00:00.000Z");
const TIER = { id: "tier_1", checklist: ["Skim"] };
const PLAN_ID = "plan_1";

function buildPlan(overrides: Partial<MaterializablePlan> = {}): MaterializablePlan {
  return {
    id: PLAN_ID,
    customerId: "cus_1",
    propertyId: "prop_1",
    technicianId: "tech_1",
    serviceTierId: TIER.id,
    serviceType: "WEEKLY_CLEANING",
    priority: "NORMAL",
    frequency: "WEEKLY",
    nextRunAt: LAST_THURSDAY_9AM,
    estimatedDurationMinutes: 45,
    checklist: null,
    notes: null,
    isActive: true,
    customer: { estadoCuenta: "ACTIVE", pauseServicesFrom: null },
    ...overrides,
  };
}

type FindFirstArgs = { where: { scheduledDate?: Date } };
type CreateArgs = { data: { scheduledDate: Date; planId: string } };
type CreatedJob = {
  id: string;
  technicianId: string | null;
  customerId: string;
  scheduledDate: Date;
  customer: { nombre: string; apellidos: string; email: string };
  property: { address: string };
};

function createDbMock(plans: readonly MaterializablePlan[], existingDates: readonly Date[] = []) {
  const existingIso = new Set(existingDates.map((date) => date.toISOString()));
  return {
    servicePlan: {
      findMany: vi.fn(async () => plans),
      update: vi.fn(async () => ({})),
    },
    serviceTier: {
      findUnique: vi.fn(async () => TIER),
      findFirst: vi.fn(async () => TIER),
    },
    job: {
      findFirst: vi.fn(async (args: FindFirstArgs) =>
        args.where.scheduledDate && existingIso.has(args.where.scheduledDate.toISOString())
          ? { id: "existing" }
          : null
      ),
      create: vi.fn<(args: CreateArgs) => Promise<CreatedJob>>(async (args) => ({
        id: `job_${args.data.scheduledDate.toISOString()}`,
        technicianId: "tech_1",
        customerId: "cus_1",
        scheduledDate: args.data.scheduledDate,
        customer: { nombre: "Ana", apellidos: "Perez", email: "ana@example.com" },
        property: { address: "123 Palm Ave" },
      })),
    },
  };
}

function createdDates(db: ReturnType<typeof createDbMock>) {
  return db.job.create.mock.calls.map(([args]) => args.data.scheduledDate);
}

beforeEach(() => {
  vi.clearAllMocks();
  materializeMocks.queueJobScheduledNotifications.mockResolvedValue(undefined);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("listPlanOccurrences", () => {
  it("advances past dates and lists the occurrences up to the horizon", () => {
    const { dates, nextRunAt } = listPlanOccurrences(buildPlan(), resolvePlanHorizon(NOW));

    expect(dates).toEqual(OCCURRENCES);
    expect(nextRunAt).toEqual(NEXT_RUN_AFTER_HORIZON);
    expect(RECURRING_LOOKAHEAD_DAYS).toBe(28);
  });

  it("stops at the customer's pause date and leaves nextRunAt on the paused occurrence", () => {
    const plan = buildPlan({ customer: { estadoCuenta: "ACTIVE", pauseServicesFrom: PAUSE_FROM } });

    const { dates, nextRunAt } = listPlanOccurrences(plan, resolvePlanHorizon(NOW));

    expect(dates).toEqual(OCCURRENCES.slice(0, 2));
    expect(nextRunAt).toEqual(OCCURRENCES[2]);
  });
});

describe("processRecurringPlans", () => {
  it("materializes every occurrence in the horizon once, queues its notifications and advances the plan", async () => {
    const db = createDbMock([buildPlan()]);

    const summary = await processRecurringPlans({ db: asWorkerDb(db), logger: createLoggerStub(), now: NOW });

    expect(createdDates(db)).toEqual(OCCURRENCES);
    expect(db.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planId: PLAN_ID, type: "ROUTINE", requestedAt: NOW }),
      })
    );
    expect(materializeMocks.queueJobScheduledNotifications).toHaveBeenCalledTimes(OCCURRENCES.length);
    expect(db.servicePlan.update).toHaveBeenCalledWith({
      where: { id: PLAN_ID },
      data: { nextRunAt: NEXT_RUN_AFTER_HORIZON },
    });
    expect(summary).toEqual({ plans: 1, created: OCCURRENCES.length, advanced: 1, failed: 0 });
  });

  it("does not duplicate jobs that already exist for the plan on the same date", async () => {
    const db = createDbMock([buildPlan()], OCCURRENCES.slice(0, 2));

    const summary = await processRecurringPlans({ db: asWorkerDb(db), logger: createLoggerStub(), now: NOW });

    expect(createdDates(db)).toEqual(OCCURRENCES.slice(2));
    expect(materializeMocks.queueJobScheduledNotifications).toHaveBeenCalledTimes(3);
    expect(summary.created).toBe(3);
  });

  it("creates nothing on a second run when every occurrence exists and the plan is up to date", async () => {
    const db = createDbMock([buildPlan({ nextRunAt: NEXT_RUN_AFTER_HORIZON })], OCCURRENCES);

    const summary = await processRecurringPlans({ db: asWorkerDb(db), logger: createLoggerStub(), now: NOW });

    expect(db.job.create).not.toHaveBeenCalled();
    expect(db.servicePlan.update).not.toHaveBeenCalled();
    expect(summary).toEqual({ plans: 1, created: 0, advanced: 0, failed: 0 });
  });

  it("isolates a failing plan and keeps processing the others", async () => {
    const failing = buildPlan({ id: "plan_failing" });
    const db = createDbMock([failing, buildPlan()]);
    db.job.create
      .mockRejectedValueOnce(new Error("insert failed"))
      .mockImplementation(async (args) => ({
        id: "job_ok",
        technicianId: null,
        customerId: "cus_1",
        scheduledDate: args.data.scheduledDate,
        customer: { nombre: "Ana", apellidos: "Perez", email: "ana@example.com" },
        property: { address: "123 Palm Ave" },
      }));
    const logger = createLoggerStub();

    const summary = await processRecurringPlans({ db: asWorkerDb(db), logger, now: NOW });

    expect(logger.error).toHaveBeenCalledWith(
      "recurring plan materialization failed",
      expect.objectContaining({ planId: "plan_failing" })
    );
    expect(summary).toEqual({ plans: 2, created: OCCURRENCES.length, advanced: 1, failed: 1 });
  });
});
