import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  // El módulo de zona horaria lee el entorno en tiempo de import.
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
  const client = {
    job: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    technician: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    techDigestItem: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { client, transaction: vi.fn(), publishNotification: vi.fn() };
});

vi.mock("@/lib/db", () => ({
  prisma: { ...mocks.client, $transaction: mocks.transaction },
}));

vi.mock("@/lib/notifications/realtime", () => ({
  publishNotification: mocks.publishNotification,
}));

import { applyJobLifecycleUpdate } from "@/lib/jobs/lifecycle";

type CreateArgs = { data: Record<string, unknown> };

const JOB_ID = "job_1";
const CUSTOMER_ID = "cus_1";
const ACTOR_USER_ID = "user_admin";
const ORIGINAL_DATE = new Date("2026-09-21T13:00:00.000Z");
const NEW_DATE = new Date("2026-09-22T13:00:00.000Z");
const ORIGINAL_SORT_ORDER = 540;
const TECH_A = { id: "tech_a", userId: "user_tech_a", user: { fullName: "Tech A" } };
const TECH_B = { id: "tech_b", userId: "user_tech_b", user: { fullName: "Tech B" } };
const CUSTOMER = { id: CUSTOMER_ID, nombre: "Ana", apellidos: "Pérez", email: "ana@example.com" };
const PROPERTY = { id: "prop_1", address: "Calle Mayor 1" };
const ACTOR = { email: "admin@example.com", fullName: "Admin Uno" };

const existingSnapshot = {
  id: JOB_ID,
  scheduledDate: ORIGINAL_DATE,
  technicianId: TECH_A.id,
  sortOrder: ORIGINAL_SORT_ORDER,
  status: "SCHEDULED",
  priority: "NORMAL",
  serviceType: "WEEKLY_CLEANING",
  notes: null,
  customerNotes: null,
} as const;

function buildUpdatedJob(overrides: Record<string, unknown> = {}) {
  return {
    ...existingSnapshot,
    customerId: CUSTOMER_ID,
    propertyId: PROPERTY.id,
    customer: CUSTOMER,
    property: PROPERTY,
    technician: TECH_A,
    ...overrides,
  };
}

/** Orden observado de commit y publicaciones; se reinicia por test. */
let timeline: string[] = [];

function createdNotifications() {
  return mocks.client.notification.create.mock.calls.map(
    ([args]) => (args as CreateArgs).data
  );
}

function createdDigestItems() {
  return mocks.client.techDigestItem.create.mock.calls.map(
    ([args]) => (args as CreateArgs).data
  );
}

function lastAuditData() {
  const lastCall = mocks.client.auditLog.create.mock.calls.at(-1);
  return (lastCall?.[0] as CreateArgs | undefined)?.data;
}

beforeEach(() => {
  timeline = [];
  for (const model of Object.values(mocks.client)) {
    for (const fn of Object.values(model)) {
      fn.mockReset();
    }
  }
  mocks.transaction.mockReset();
  mocks.publishNotification.mockReset();

  mocks.transaction.mockImplementation(
    async (callback: (tx: typeof mocks.client) => Promise<unknown>) => {
      const result = await callback(mocks.client);
      timeline = [...timeline, "commit"];
      return result;
    }
  );
  mocks.publishNotification.mockImplementation(async () => {
    timeline = [...timeline, "publish"];
  });
  mocks.client.job.findUnique.mockResolvedValue(existingSnapshot);
  mocks.client.job.count.mockResolvedValue(2);
  mocks.client.user.findUnique.mockResolvedValue(ACTOR);
  mocks.client.notification.create.mockImplementation(async ({ data }: CreateArgs) => ({
    id: `notif_${mocks.client.notification.create.mock.calls.length}`,
    createdAt: new Date("2026-09-17T10:00:00.000Z"),
    ...data,
  }));
  mocks.client.techDigestItem.create.mockResolvedValue({ id: "digest_item" });
  mocks.client.auditLog.create.mockResolvedValue({ id: "audit_1" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("applyJobLifecycleUpdate", () => {
  it("reprograma el job en una transacción, notifica y publica solo tras el commit", async () => {
    mocks.client.job.update.mockResolvedValue(buildUpdatedJob({ scheduledDate: NEW_DATE }));

    const result = await applyJobLifecycleUpdate({
      jobId: JOB_ID,
      actorUserId: ACTOR_USER_ID,
      data: { scheduledDate: NEW_DATE },
    });

    expect(result?.scheduledDate).toEqual(NEW_DATE);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.client.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: JOB_ID }, data: { scheduledDate: NEW_DATE } })
    );

    expect(createdDigestItems()).toEqual([
      expect.objectContaining({
        technicianId: TECH_A.id,
        jobId: JOB_ID,
        changeType: "JOB_RESCHEDULED",
        payload: expect.objectContaining({
          fromScheduledDate: ORIGINAL_DATE.toISOString(),
          toScheduledDate: NEW_DATE.toISOString(),
        }),
      }),
    ]);

    const notifications = createdNotifications();
    expect(notifications.map((item) => [item.recipientRole, item.eventType])).toEqual([
      ["CUSTOMER", "ROUTE_UPDATED"],
      ["CUSTOMER", "SERVICE_RESCHEDULED"],
      ["TECH", "ROUTE_UPDATED"],
    ]);
    expect(notifications[2]).toMatchObject({
      recipientUserId: TECH_A.userId,
      severity: "WARNING",
      payload: expect.objectContaining({
        changeType: "RESCHEDULED",
        recipientUserId: TECH_A.userId,
        customerName: "Ana Pérez",
        address: PROPERTY.address,
      }),
    });

    expect(lastAuditData()).toMatchObject({
      userId: ACTOR_USER_ID,
      actorEmail: ACTOR.email,
      actorName: ACTOR.fullName,
      action: "JOB_LIFECYCLE_UPDATED",
      entity: "Job",
      entityId: JOB_ID,
      metadata: {
        customerId: CUSTOMER_ID,
        propertyId: PROPERTY.id,
        changes: {
          scheduledDate: { from: ORIGINAL_DATE.toISOString(), to: NEW_DATE.toISOString() },
        },
      },
    });

    expect(mocks.publishNotification).toHaveBeenCalledTimes(3);
    expect(timeline).toEqual(["commit", "publish", "publish", "publish"]);
  });

  it("al cambiar de técnico notifica al nuevo y al anterior y encola ambos digests", async () => {
    mocks.client.job.update.mockResolvedValue(
      buildUpdatedJob({ technicianId: TECH_B.id, technician: TECH_B })
    );
    mocks.client.technician.findUnique.mockResolvedValue({ id: TECH_A.id, userId: TECH_A.userId });
    mocks.client.job.count.mockResolvedValue(0);

    const result = await applyJobLifecycleUpdate({
      jobId: JOB_ID,
      actorUserId: ACTOR_USER_ID,
      data: { technician: { connect: { id: TECH_B.id } } },
    });

    expect(result?.technicianId).toBe(TECH_B.id);
    expect(createdDigestItems().map((item) => [item.technicianId, item.changeType])).toEqual([
      [TECH_A.id, "JOB_UNASSIGNED"],
      [TECH_B.id, "ROUTE_ASSIGNED"],
    ]);

    const notifications = createdNotifications();
    expect(
      notifications.map((item) => [item.recipientRole, item.eventType, item.recipientUserId])
    ).toEqual([
      ["CUSTOMER", "ROUTE_UPDATED", null],
      ["TECH", "ROUTE_UPDATED", TECH_B.userId],
      ["TECH", "ROUTE_UPDATED", TECH_A.userId],
    ]);
    expect(notifications[1].payload).toMatchObject({ changeType: "ASSIGNED", technicianId: TECH_B.id });
    expect(notifications[2].payload).toMatchObject({
      changeType: "UNASSIGNED",
      technicianId: TECH_A.id,
      scheduledDate: ORIGINAL_DATE.toISOString(),
    });
    expect(lastAuditData()?.metadata).toMatchObject({
      changes: { technicianId: { from: TECH_A.id, to: TECH_B.id } },
    });
    expect(mocks.publishNotification).toHaveBeenCalledTimes(3);
  });

  it("no falla la operación cuando la publicación en tiempo real rechaza", async () => {
    mocks.client.job.update.mockResolvedValue(buildUpdatedJob({ scheduledDate: NEW_DATE }));
    mocks.publishNotification.mockRejectedValue(new Error("pusher down"));

    const result = await applyJobLifecycleUpdate({
      jobId: JOB_ID,
      actorUserId: ACTOR_USER_ID,
      data: { scheduledDate: NEW_DATE },
    });

    expect(result?.id).toBe(JOB_ID);
    expect(mocks.client.notification.create).toHaveBeenCalledTimes(3);
    expect(mocks.client.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mocks.publishNotification).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it("usa el snapshot precargado sin volver a leer el job", async () => {
    mocks.client.job.update.mockResolvedValue(
      buildUpdatedJob({ sortOrder: ORIGINAL_SORT_ORDER + 1 })
    );

    const result = await applyJobLifecycleUpdate({
      jobId: JOB_ID,
      actorUserId: null,
      preloaded: existingSnapshot,
      data: { sortOrder: ORIGINAL_SORT_ORDER + 1 },
    });

    expect(result?.sortOrder).toBe(ORIGINAL_SORT_ORDER + 1);
    expect(mocks.client.job.findUnique).not.toHaveBeenCalled();
    expect(createdDigestItems().map((item) => item.changeType)).toEqual(["ROUTE_REORDERED"]);
    expect(createdNotifications().map((item) => item.payload)).toEqual([
      expect.objectContaining({ changeType: "REORDERED" }),
    ]);
    expect(mocks.client.auditLog.create).not.toHaveBeenCalled();
  });

  it("devuelve null y no escribe nada cuando el job no existe", async () => {
    mocks.client.job.findUnique.mockResolvedValue(null);

    const result = await applyJobLifecycleUpdate({
      jobId: "missing",
      actorUserId: ACTOR_USER_ID,
      data: { scheduledDate: NEW_DATE },
    });

    expect(result).toBeNull();
    expect(mocks.client.job.update).not.toHaveBeenCalled();
    expect(mocks.publishNotification).not.toHaveBeenCalled();
  });

  it("es idempotente: sin cambios relevantes no encola, no notifica ni audita", async () => {
    mocks.client.job.update.mockResolvedValue(buildUpdatedJob());

    await applyJobLifecycleUpdate({
      jobId: JOB_ID,
      actorUserId: ACTOR_USER_ID,
      data: { scheduledDate: ORIGINAL_DATE },
    });

    expect(mocks.client.techDigestItem.create).not.toHaveBeenCalled();
    expect(mocks.client.notification.create).not.toHaveBeenCalled();
    expect(mocks.client.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.publishNotification).not.toHaveBeenCalled();
  });

  it("propaga un fallo de auditoría dentro de la transacción y no publica", async () => {
    mocks.client.job.update.mockResolvedValue(buildUpdatedJob({ scheduledDate: NEW_DATE }));
    mocks.client.auditLog.create.mockRejectedValue(new Error("audit insert failed"));

    await expect(
      applyJobLifecycleUpdate({
        jobId: JOB_ID,
        actorUserId: ACTOR_USER_ID,
        data: { scheduledDate: NEW_DATE },
      })
    ).rejects.toThrow("audit insert failed");

    expect(mocks.publishNotification).not.toHaveBeenCalled();
  });
});
