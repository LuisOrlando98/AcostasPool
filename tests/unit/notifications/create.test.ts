import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  notificationCreate: vi.fn(),
  txNotificationCreate: vi.fn(),
  publishNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { notification: { create: mocks.notificationCreate } },
}));

vi.mock("@/lib/notifications/realtime", () => ({
  publishNotification: mocks.publishNotification,
}));

import { createNotification } from "@/lib/notifications/create";

const CREATED_AT = new Date("2026-09-17T10:00:00.000Z");
const NOTIFICATION_ID = "notif_1";
const CUSTOMER_ID = "cus_1";
const TECH_USER_ID = "user_tech";
const ACTOR_USER_ID = "user_admin";

type CreateArgs = { data: Record<string, unknown> };

function rowFromCreate({ data }: CreateArgs) {
  return {
    id: NOTIFICATION_ID,
    createdAt: CREATED_AT,
    sentAt: null,
    readAt: null,
    attempts: 0,
    lastAttemptAt: null,
    payload: null,
    actorUserId: null,
    customerId: null,
    recipientUserId: null,
    ...data,
  };
}

function lastCreateData(mock: typeof mocks.notificationCreate) {
  const lastCall = mock.mock.calls.at(-1);
  return (lastCall?.[0] as CreateArgs | undefined)?.data;
}

beforeEach(() => {
  mocks.notificationCreate.mockReset();
  mocks.txNotificationCreate.mockReset();
  mocks.publishNotification.mockReset();
  mocks.notificationCreate.mockImplementation(async (args: CreateArgs) => rowFromCreate(args));
  mocks.txNotificationCreate.mockImplementation(async (args: CreateArgs) => rowFromCreate(args));
  mocks.publishNotification.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createNotification", () => {
  it("escribe recipientUserId en la columna y lo conserva en el payload", async () => {
    await createNotification({
      customerId: CUSTOMER_ID,
      recipientRole: "TECH",
      recipientUserId: TECH_USER_ID,
      eventType: "ROUTE_UPDATED",
      payload: { jobId: "job_1" },
    });

    expect(lastCreateData(mocks.notificationCreate)).toMatchObject({
      customerId: CUSTOMER_ID,
      recipientUserId: TECH_USER_ID,
      recipientRole: "TECH",
      eventType: "ROUTE_UPDATED",
      severity: "INFO",
      status: "QUEUED",
      channel: "EMAIL",
      payload: { jobId: "job_1", recipientUserId: TECH_USER_ID },
    });
  });

  it("permite customerId nulo para ADMIN y no inventa un payload vacío", async () => {
    await createNotification({
      recipientRole: "ADMIN",
      eventType: "CUSTOMER_REQUEST",
      actorUserId: ACTOR_USER_ID,
    });

    expect(lastCreateData(mocks.notificationCreate)).toMatchObject({
      customerId: null,
      recipientUserId: null,
      actorUserId: ACTOR_USER_ID,
      payload: undefined,
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("publica en tiempo real con los datos de la fila creada y devuelve la fila", async () => {
    const notification = await createNotification({
      customerId: CUSTOMER_ID,
      recipientRole: "CUSTOMER",
      eventType: "SERVICE_SCHEDULED",
      severity: "WARNING",
      actorUserId: ACTOR_USER_ID,
    });

    expect(notification.id).toBe(NOTIFICATION_ID);
    expect(mocks.publishNotification).toHaveBeenCalledWith({
      id: NOTIFICATION_ID,
      eventType: "SERVICE_SCHEDULED",
      recipientRole: "CUSTOMER",
      recipientUserId: null,
      actorUserId: ACTOR_USER_ID,
      customerId: CUSTOMER_ID,
      severity: "WARNING",
      createdAt: CREATED_AT.toISOString(),
    });
  });

  it("no relanza cuando la publicación en tiempo real rechaza", async () => {
    mocks.publishNotification.mockRejectedValue(new Error("pusher down"));

    await expect(
      createNotification({
        customerId: CUSTOMER_ID,
        recipientRole: "CUSTOMER",
        eventType: "SERVICE_SCHEDULED",
      })
    ).resolves.toMatchObject({ id: NOTIFICATION_ID });

    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("no relanza cuando la publicación lanza de forma síncrona", async () => {
    mocks.publishNotification.mockImplementation(() => {
      throw new Error("boom");
    });

    await expect(
      createNotification({
        customerId: CUSTOMER_ID,
        recipientRole: "CUSTOMER",
        eventType: "SERVICE_SCHEDULED",
      })
    ).resolves.toMatchObject({ id: NOTIFICATION_ID });

    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("con tx escribe en la transacción y difiere la publicación hasta publish()", async () => {
    const tx = {
      notification: { create: mocks.txNotificationCreate },
    } as unknown as Prisma.TransactionClient;

    const created = await createNotification({
      tx,
      customerId: CUSTOMER_ID,
      recipientRole: "TECH",
      recipientUserId: TECH_USER_ID,
      eventType: "ROUTE_UPDATED",
    });

    expect(mocks.txNotificationCreate).toHaveBeenCalledTimes(1);
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
    expect(mocks.publishNotification).not.toHaveBeenCalled();
    expect(created.notification.id).toBe(NOTIFICATION_ID);

    await created.publish();

    expect(mocks.publishNotification).toHaveBeenCalledTimes(1);
    expect(mocks.publishNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: NOTIFICATION_ID, recipientUserId: TECH_USER_ID })
    );
  });

  it("publish() diferido tampoco relanza si el canal falla", async () => {
    mocks.publishNotification.mockRejectedValue(new Error("pusher down"));
    const tx = {
      notification: { create: mocks.txNotificationCreate },
    } as unknown as Prisma.TransactionClient;

    const created = await createNotification({
      tx,
      customerId: CUSTOMER_ID,
      recipientRole: "CUSTOMER",
      eventType: "SERVICE_SCHEDULED",
    });

    await expect(created.publish()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("advierte cuando falta el destinatario TECH o el cliente de un CUSTOMER", async () => {
    await createNotification({ recipientRole: "TECH", eventType: "ROUTE_UPDATED" });
    await createNotification({ recipientRole: "CUSTOMER", eventType: "SERVICE_SCHEDULED" });

    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});
