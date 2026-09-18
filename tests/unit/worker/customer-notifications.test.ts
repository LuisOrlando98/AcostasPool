import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// El módulo de zona horaria lee el entorno en tiempo de import.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/mail/transport", () => ({ sendMailAndLog: vi.fn() }));

import {
  MAX_SEND_ATTEMPTS,
  PROCESSING_ORPHAN_THRESHOLD_MS,
  RETRY_BASE_DELAY_MS,
} from "@/lib/worker/constants";
import { processCustomerNotifications } from "@/lib/worker/customer-notifications";
import { buildDeps, createLoggerStub, createMailerStub } from "./helpers";

/** Jueves 17 de septiembre de 2026, 10:00 EDT. */
const NOW = new Date("2026-09-17T14:00:00.000Z");
const ONE_MINUTE_MS = 60_000;
const JOB_ID = "job_1";
const CUSTOMER_ID = "cus_1";
const FIRST_ATTEMPT = 1;

const JOB = {
  id: JOB_ID,
  customerId: CUSTOMER_ID,
  scheduledDate: new Date("2026-09-18T13:00:00.000Z"),
  completedAt: null,
  customer: {
    nombre: "Ana",
    apellidos: "Perez",
    email: "ana@example.com",
    idiomaPreferencia: "ES",
  },
  property: { address: "123 Palm Ave" },
  technician: { user: { fullName: "Carlos Diaz" } },
};

type NotificationRow = {
  id: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  attempts: number;
  createdAt: Date;
};
type FindManyArgs = { where: { status?: string } };
type UpdateManyArgs = { where: { status?: string; attempts?: { lt?: number; gte?: number } } };
type Queues = {
  failed?: readonly { id: string; attempts: number; lastAttemptAt: Date | null }[];
  queued?: readonly { id: string }[];
  claimed?: readonly NotificationRow[];
};

function buildClaimed(id: string, overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id,
    eventType: "SERVICE_SCHEDULED",
    payload: { jobId: JOB_ID },
    attempts: FIRST_ATTEMPT,
    createdAt: NOW,
    ...overrides,
  };
}

function createDbMock(queues: Queues = {}) {
  const findMany = vi.fn(async (args: FindManyArgs) => {
    if (args.where.status === "FAILED") {
      return queues.failed ?? [];
    }
    if (args.where.status === "QUEUED") {
      return queues.queued ?? [];
    }
    return queues.claimed ?? [];
  });
  return {
    notification: {
      findMany,
      updateMany: vi
        .fn<(args: UpdateManyArgs) => Promise<{ count: number }>>()
        .mockResolvedValue({ count: 0 }),
      update: vi.fn(async () => ({})),
    },
    job: { findUnique: vi.fn<() => Promise<typeof JOB | null>>().mockResolvedValue(JOB) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("processCustomerNotifications", () => {
  it("claims the queued batch atomically and delivers only the rows the claim marked", async () => {
    const db = createDbMock({
      queued: [{ id: "n1" }, { id: "n2" }],
      claimed: [buildClaimed("n1")],
    });
    const mailer = createMailerStub();
    const deps = buildDeps(db, NOW, { mailer });

    const summary = await processCustomerNotifications(deps);

    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["n1", "n2"] }, status: "QUEUED" },
      data: { status: "PROCESSING", lastAttemptAt: NOW, attempts: { increment: 1 } },
    });
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["n1", "n2"] }, status: "PROCESSING", lastAttemptAt: NOW },
      })
    );
    expect(mailer).toHaveBeenCalledTimes(1);
    expect(mailer).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@example.com",
        recipientName: "Ana Perez",
        recipientRole: "CUSTOMER",
        template: "CUSTOMER_SERVICE_SCHEDULED",
        customerId: CUSTOMER_ID,
        jobId: JOB_ID,
        metadata: { notificationId: "n1", eventType: "SERVICE_SCHEDULED", attempt: FIRST_ATTEMPT },
      })
    );
    const [mailInput] = mailer.mock.calls[0];
    expect(mailInput.subject.startsWith("Servicio confirmado - ")).toBe(true);
    expect(mailInput.text).toContain("Hola Ana Perez");
    expect(mailInput.text).toContain("Direccion: 123 Palm Ave");
    expect(db.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { status: "SENT", sentAt: NOW },
    });
    expect(summary).toEqual({
      recovered: 0,
      exhausted: 0,
      retried: 0,
      claimed: 1,
      sent: 1,
      failed: 0,
    });
  });

  it("only selects customer e-mail events with recipientRole CUSTOMER", async () => {
    const db = createDbMock();

    await processCustomerNotifications(buildDeps(db, NOW));

    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          channel: "EMAIL",
          recipientRole: "CUSTOMER",
          eventType: { in: ["SERVICE_SCHEDULED", "SERVICE_RESCHEDULED", "JOB_COMPLETED"] },
          status: "QUEUED",
        }),
      })
    );
  });

  it("leaves recent PROCESSING rows alone and only recovers those older than the threshold", async () => {
    const db = createDbMock();
    const mailer = createMailerStub();
    const staleBefore = new Date(NOW.getTime() - PROCESSING_ORPHAN_THRESHOLD_MS);

    await processCustomerNotifications(buildDeps(db, NOW, { mailer }));

    const recoveryCalls = db.notification.updateMany.mock.calls.map(([args]) => args);
    expect(recoveryCalls).toHaveLength(2);
    recoveryCalls.forEach((args) => {
      expect(args.where).toEqual(
        expect.objectContaining({
          status: "PROCESSING",
          OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: staleBefore } }],
        })
      );
    });
    expect(recoveryCalls[0].where.attempts).toEqual({ gte: MAX_SEND_ATTEMPTS });
    expect(recoveryCalls[1].where.attempts).toEqual({ lt: MAX_SEND_ATTEMPTS });
    expect(mailer).not.toHaveBeenCalled();
  });

  it("requeues orphans with attempts left and fails the exhausted ones", async () => {
    const db = createDbMock();
    db.notification.updateMany.mockImplementation(async (args: UpdateManyArgs) => {
      if (args.where.status !== "PROCESSING") {
        return { count: 0 };
      }
      return { count: args.where.attempts?.lt === MAX_SEND_ATTEMPTS ? 2 : 1 };
    });
    const logger = createLoggerStub();

    const summary = await processCustomerNotifications(buildDeps(db, NOW, { logger }));

    expect(db.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "QUEUED" } })
    );
    expect(db.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "FAILED" } })
    );
    expect(summary.recovered).toBe(2);
    expect(summary.exhausted).toBe(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("retries FAILED rows whose exponential backoff elapsed and respects the attempts cap", async () => {
    const threeMinutesAgo = new Date(NOW.getTime() - 3 * ONE_MINUTE_MS);
    const db = createDbMock({
      failed: [
        { id: "due", attempts: 1, lastAttemptAt: threeMinutesAgo },
        { id: "not-due", attempts: 2, lastAttemptAt: threeMinutesAgo },
        { id: "never-tried", attempts: 3, lastAttemptAt: null },
      ],
    });
    db.notification.updateMany.mockImplementation(async (args: UpdateManyArgs) => ({
      count: args.where.status === "FAILED" ? 2 : 0,
    }));

    const summary = await processCustomerNotifications(buildDeps(db, NOW));

    expect(RETRY_BASE_DELAY_MS).toBe(2 * ONE_MINUTE_MS);
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "FAILED",
          attempts: { gt: 0, lt: MAX_SEND_ATTEMPTS },
        }),
      })
    );
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["due", "never-tried"] }, status: "FAILED" },
      data: { status: "QUEUED" },
    });
    expect(summary.retried).toBe(2);
  });

  it("marks the notification FAILED when the mailer reports a failure", async () => {
    const db = createDbMock({ queued: [{ id: "n1" }], claimed: [buildClaimed("n1")] });
    const logger = createLoggerStub();

    const summary = await processCustomerNotifications(
      buildDeps(db, NOW, { mailer: createMailerStub(false), logger })
    );

    expect(db.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { status: "FAILED", sentAt: null },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "customer e-mail not sent",
      expect.objectContaining({ notificationId: "n1", reason: "send_failed" })
    );
    expect(summary.failed).toBe(1);
  });

  it("fails without sending when the payload has no job or the job no longer exists", async () => {
    const db = createDbMock({
      queued: [{ id: "n1" }, { id: "n2" }],
      claimed: [buildClaimed("n1", { payload: null }), buildClaimed("n2")],
    });
    db.job.findUnique.mockResolvedValue(null);
    const mailer = createMailerStub();

    const summary = await processCustomerNotifications(buildDeps(db, NOW, { mailer }));

    expect(mailer).not.toHaveBeenCalled();
    expect(db.notification.update).toHaveBeenCalledTimes(2);
    expect(summary).toEqual(expect.objectContaining({ claimed: 2, sent: 0, failed: 2 }));
  });

  it("renders the completed-job e-mail in the customer's locale with the payload technician", async () => {
    const completedAt = new Date("2026-09-17T13:10:00.000Z");
    const db = createDbMock({
      queued: [{ id: "n1" }],
      claimed: [
        buildClaimed("n1", {
          eventType: "JOB_COMPLETED",
          payload: { jobId: JOB_ID, technicianName: "Luis Gomez", completedAt: completedAt.toISOString() },
        }),
      ],
    });
    db.job.findUnique.mockResolvedValue({
      ...JOB,
      customer: { ...JOB.customer, idiomaPreferencia: "EN" },
    });
    const mailer = createMailerStub();

    await processCustomerNotifications(buildDeps(db, NOW, { mailer }));

    const [mailInput] = mailer.mock.calls[0];
    expect(mailInput.template).toBe("CUSTOMER_JOB_COMPLETED");
    expect(mailInput.subject.startsWith("Service completed - ")).toBe(true);
    expect(mailInput.text).toContain("Hi Ana Perez");
    expect(mailInput.text).toContain("completed by Luis Gomez");
    expect(mailInput.text).toContain("Sep 17, 2026, 09:10 AM");
  });

  it("keeps processing the batch when one notification throws", async () => {
    const db = createDbMock({
      queued: [{ id: "n1" }, { id: "n2" }],
      claimed: [buildClaimed("n1"), buildClaimed("n2")],
    });
    db.job.findUnique.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(JOB);
    const logger = createLoggerStub();
    const mailer = createMailerStub();

    const summary = await processCustomerNotifications(buildDeps(db, NOW, { mailer, logger }));

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(mailer).toHaveBeenCalledTimes(1);
    expect(summary).toEqual(expect.objectContaining({ sent: 1, failed: 1 }));
  });
});
