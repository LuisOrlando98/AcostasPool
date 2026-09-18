import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/mail/transport", () => ({ sendMailAndLog: vi.fn() }));

import { MAX_SEND_ATTEMPTS, PROCESSING_ORPHAN_THRESHOLD_MS } from "@/lib/worker/constants";
import { retryFailedDigests, sendChangeDigest, sendDailyPlan } from "@/lib/worker/tech-digests";
import { buildDeps, createLoggerStub, createMailerStub } from "./helpers";

/** Jueves 17 de septiembre de 2026, 06:30 EDT. */
const NOW = new Date("2026-09-17T10:30:00.000Z");
/** Inicio del día de ruta (00:00 EDT). */
const ROUTE_DATE = new Date("2026-09-17T04:00:00.000Z");
const ONE_MINUTE_MS = 60_000;
const TECH_ID = "tech_1";
const DIGEST_ID = "digest_1";
const ITEM_ID = "item_1";
const TECH = { id: TECH_ID, user: { fullName: "Carlos Diaz", email: "carlos@example.com" } };
const CUSTOMER = { nombre: "Ana", apellidos: "Perez", email: "ana@example.com" };
const ROUTE_JOBS = [
  {
    id: "job_1",
    scheduledDate: new Date("2026-09-17T13:00:00.000Z"),
    customer: CUSTOMER,
    property: { address: "123 Palm Ave" },
  },
];
const LINKED_ITEMS = [
  {
    id: ITEM_ID,
    changeType: "JOB_ASSIGNED",
    payload: { toScheduledDate: "2026-09-17T15:30:00.000Z" },
    job: {
      scheduledDate: new Date("2026-09-17T15:30:00.000Z"),
      customer: CUSTOMER,
      property: { address: "77 Ocean Dr" },
    },
  },
];

type DigestRow = {
  id: string;
  technicianId: string;
  routeDate: Date;
  window: string;
  status: string;
  updatedAt: Date;
};
type JobFindManyArgs = { distinct?: readonly string[] };
type ItemFindManyArgs = { where: { digestId: string | null } };
type CreateArgs = { data: Record<string, unknown> };
type UpdateArgs = { where: { id: string }; data: Record<string, unknown> };
type CountArgs = { where: { digestId: string } };
type DigestCandidate = DigestRow & { technician: typeof TECH };

function buildDigest(overrides: Partial<DigestRow> = {}): DigestRow {
  return {
    id: DIGEST_ID,
    technicianId: TECH_ID,
    routeDate: ROUTE_DATE,
    window: "MORNING",
    status: "PROCESSING",
    updatedAt: NOW,
    ...overrides,
  };
}

function createDbMock(existing: DigestRow | null = null) {
  return {
    job: {
      findMany: vi.fn(async (args: JobFindManyArgs) =>
        args.distinct ? [{ technicianId: TECH_ID, technician: TECH }] : ROUTE_JOBS
      ),
    },
    techDigest: {
      findFirst: vi.fn(async () => existing),
      create: vi.fn(async (args: CreateArgs) => buildDigest({ ...args.data, id: DIGEST_ID })),
      update: vi.fn(async (args: UpdateArgs) =>
        buildDigest({ ...(existing ?? {}), ...args.data, id: args.where.id })
      ),
      findMany: vi.fn<() => Promise<DigestCandidate[]>>().mockResolvedValue([]),
    },
    techDigestItem: {
      findMany: vi.fn(async (args: ItemFindManyArgs) =>
        args.where.digestId === null
          ? [{ id: ITEM_ID, technicianId: TECH_ID, technician: TECH }]
          : LINKED_ITEMS
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    emailLog: { count: vi.fn<(args: CountArgs) => Promise<number>>().mockResolvedValue(0) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("sendDailyPlan", () => {
  it("creates the MORNING digest, sends it and marks it SENT", async () => {
    const db = createDbMock();
    const mailer = createMailerStub();

    const summary = await sendDailyPlan(buildDeps(db, NOW, { mailer }));

    expect(db.techDigest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { technicianId: TECH_ID, routeDate: ROUTE_DATE, window: "MORNING" },
      })
    );
    expect(db.techDigest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          technicianId: TECH_ID,
          routeDate: ROUTE_DATE,
          window: "MORNING",
          status: "PROCESSING",
          scheduledFor: NOW,
        },
      })
    );
    expect(mailer).toHaveBeenCalledTimes(1);
    const [mailInput] = mailer.mock.calls[0];
    expect(mailInput).toEqual(
      expect.objectContaining({
        to: "carlos@example.com",
        recipientRole: "TECH",
        template: "TECH_DAILY_DIGEST",
        technicianId: TECH_ID,
        digestId: DIGEST_ID,
        subject: "Ruta diaria confirmada - Carlos Diaz - 09/17/2026",
      })
    );
    expect(mailInput.text).toContain("1. Sep 17, 2026, 09:00 AM - Ana Perez - 123 Palm Ave");
    expect(db.techDigest.update).toHaveBeenCalledWith({
      where: { id: DIGEST_ID },
      data: { status: "SENT", sentAt: NOW },
    });
    expect(summary).toEqual({ sent: 1, failed: 0, skipped: 0 });
  });

  it("neither creates nor resends when the digest for the day was already sent", async () => {
    const db = createDbMock(buildDigest({ status: "SENT" }));
    const mailer = createMailerStub();

    const summary = await sendDailyPlan(buildDeps(db, NOW, { mailer }));

    expect(db.techDigest.create).not.toHaveBeenCalled();
    expect(db.techDigest.update).not.toHaveBeenCalled();
    expect(mailer).not.toHaveBeenCalled();
    expect(summary).toEqual({ sent: 0, failed: 0, skipped: 1 });
  });

  it("reuses a FAILED digest row instead of creating a second one", async () => {
    const db = createDbMock(buildDigest({ status: "FAILED" }));
    const mailer = createMailerStub();

    const summary = await sendDailyPlan(buildDeps(db, NOW, { mailer }));

    expect(db.techDigest.create).not.toHaveBeenCalled();
    expect(db.techDigest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DIGEST_ID },
        data: { status: "PROCESSING", scheduledFor: NOW },
      })
    );
    expect(mailer).toHaveBeenCalledTimes(1);
    expect(summary.sent).toBe(1);
  });

  it("skips a digest that another process claimed recently", async () => {
    const recent = new Date(NOW.getTime() - ONE_MINUTE_MS);
    const db = createDbMock(buildDigest({ status: "PROCESSING", updatedAt: recent }));
    const mailer = createMailerStub();

    const summary = await sendDailyPlan(buildDeps(db, NOW, { mailer }));

    expect(mailer).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
  });

  it("marks the digest FAILED when the mailer fails", async () => {
    const db = createDbMock();

    const summary = await sendDailyPlan(buildDeps(db, NOW, { mailer: createMailerStub(false) }));

    expect(db.techDigest.update).toHaveBeenCalledWith({
      where: { id: DIGEST_ID },
      data: { status: "FAILED", sentAt: null },
    });
    expect(summary.failed).toBe(1);
  });

  it("skips technicians without an e-mail address", async () => {
    const db = createDbMock();
    db.job.findMany.mockResolvedValue([
      { technicianId: TECH_ID, technician: { ...TECH, user: { ...TECH.user, email: " " } } },
    ]);
    const logger = createLoggerStub();

    const summary = await sendDailyPlan(buildDeps(db, NOW, { logger }));

    expect(db.techDigest.findFirst).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(summary.skipped).toBe(1);
  });
});

describe("sendChangeDigest", () => {
  it("links the pending items to the digest before sending and renders them", async () => {
    const db = createDbMock();
    const mailer = createMailerStub();

    const summary = await sendChangeDigest(buildDeps(db, NOW, { mailer }), "MIDDAY");

    expect(db.techDigestItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { digestId: null, routeDate: { gte: ROUTE_DATE, lte: expect.any(Date) } },
      })
    );
    expect(db.techDigest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ window: "MIDDAY" }) })
    );
    expect(db.techDigestItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [ITEM_ID] } },
      data: { digestId: DIGEST_ID },
    });
    const linkOrder = db.techDigestItem.updateMany.mock.invocationCallOrder[0];
    const mailOrder = mailer.mock.invocationCallOrder[0];
    expect(linkOrder).toBeLessThan(mailOrder);
    const [mailInput] = mailer.mock.calls[0];
    expect(mailInput.template).toBe("TECH_CHANGE_DIGEST");
    expect(mailInput.subject).toBe("Actualizacion de ruta - Carlos Diaz - 09/17/2026");
    expect(mailInput.text).toContain(
      "1. Trabajo asignado: Ana Perez - 77 Ocean Dr (Sep 17, 2026, 11:30 AM)"
    );
    expect(mailInput.metadata).toEqual({ window: "MIDDAY" });
    expect(summary).toEqual({ sent: 1, failed: 0, skipped: 0 });
  });

  it("leaves the items unlinked when the window's digest was already sent", async () => {
    const db = createDbMock(buildDigest({ window: "EVENING", status: "SENT" }));
    const mailer = createMailerStub();

    const summary = await sendChangeDigest(buildDeps(db, NOW, { mailer }), "EVENING");

    expect(db.techDigestItem.updateMany).not.toHaveBeenCalled();
    expect(mailer).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
  });

  it("does nothing when there are no pending items", async () => {
    const db = createDbMock();
    db.techDigestItem.findMany.mockResolvedValue([]);
    const mailer = createMailerStub();

    const summary = await sendChangeDigest(buildDeps(db, NOW, { mailer }), "MIDDAY");

    expect(db.techDigest.findFirst).not.toHaveBeenCalled();
    expect(mailer).not.toHaveBeenCalled();
    expect(summary).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });
});

describe("retryFailedDigests", () => {
  const threeMinutesAgo = new Date(NOW.getTime() - 3 * ONE_MINUTE_MS);

  it("resends a FAILED digest once its backoff elapsed and marks it SENT", async () => {
    const failed = buildDigest({ status: "FAILED", updatedAt: threeMinutesAgo });
    const db = createDbMock(failed);
    db.techDigest.findMany.mockResolvedValue([{ ...failed, technician: TECH }]);
    db.emailLog.count.mockResolvedValue(1);
    const mailer = createMailerStub();

    const summary = await retryFailedDigests(buildDeps(db, NOW, { mailer }));

    expect(db.emailLog.count).toHaveBeenCalledWith({ where: { digestId: DIGEST_ID } });
    expect(db.techDigest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PROCESSING", scheduledFor: NOW } })
    );
    expect(mailer).toHaveBeenCalledTimes(1);
    expect(db.techDigest.update).toHaveBeenLastCalledWith({
      where: { id: DIGEST_ID },
      data: { status: "SENT", sentAt: NOW },
    });
    expect(summary).toEqual({ sent: 1, failed: 0, skipped: 0 });
  });

  it("waits for the backoff and gives up after the attempts cap", async () => {
    const failed = buildDigest({ status: "FAILED", updatedAt: threeMinutesAgo });
    const db = createDbMock(failed);
    db.techDigest.findMany.mockResolvedValue([
      { ...failed, id: "not-due", technician: TECH },
      { ...failed, id: "exhausted", technician: TECH },
    ]);
    db.emailLog.count.mockImplementation(async (args) =>
      args.where.digestId === "exhausted" ? MAX_SEND_ATTEMPTS : 2
    );
    const mailer = createMailerStub();

    const summary = await retryFailedDigests(buildDeps(db, NOW, { mailer }));

    expect(mailer).not.toHaveBeenCalled();
    expect(db.techDigest.update).not.toHaveBeenCalled();
    expect(summary).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });

  it("treats a stale PROCESSING digest as an orphan and retries it", async () => {
    const stale = new Date(NOW.getTime() - PROCESSING_ORPHAN_THRESHOLD_MS - ONE_MINUTE_MS);
    const orphan = buildDigest({ status: "PROCESSING", updatedAt: stale });
    const db = createDbMock(orphan);
    db.techDigest.findMany.mockResolvedValue([{ ...orphan, technician: TECH }]);
    const mailer = createMailerStub();

    const summary = await retryFailedDigests(buildDeps(db, NOW, { mailer }));

    expect(mailer).toHaveBeenCalledTimes(1);
    expect(summary.sent).toBe(1);
  });
});
