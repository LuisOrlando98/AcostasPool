import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationEventPayload } from "@/lib/notifications/bus";

const mocks = vi.hoisted(() => ({
  trigger: vi.fn(),
  userFindMany: vi.fn(),
  customerFindUnique: vi.fn(),
  broadcastNotification: vi.fn(),
}));

vi.mock("pusher", () => ({
  default: class PusherMock {
    trigger = mocks.trigger;
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    customer: { findUnique: mocks.customerFindUnique },
  },
}));

vi.mock("@/lib/notifications/bus", () => ({
  broadcastNotification: mocks.broadcastNotification,
}));

const PUSHER_ENV = {
  PUSHER_APP_ID: "app",
  PUSHER_KEY: "key",
  PUSHER_SECRET: "secret",
  PUSHER_CLUSTER: "eu",
} as const;

const ACTOR_ID = "user_actor";
const NOTIFICATION_EVENT = "notification";

const baseEvent: NotificationEventPayload = {
  id: "notif_1",
  eventType: "CUSTOMER_REQUEST",
  recipientRole: "ADMIN",
  recipientUserId: null,
  actorUserId: ACTOR_ID,
  customerId: "cus_1",
  severity: "INFO",
  createdAt: "2026-09-17T10:00:00.000Z",
};

function stubPusherEnv(configured: boolean) {
  for (const [key, value] of Object.entries(PUSHER_ENV)) {
    vi.stubEnv(key, configured ? value : "");
  }
}

// El módulo cachea el cliente Pusher: se reimporta en cada test.
async function loadRealtime() {
  vi.resetModules();
  return import("@/lib/notifications/realtime");
}

beforeEach(() => {
  mocks.trigger.mockReset();
  mocks.userFindMany.mockReset();
  mocks.customerFindUnique.mockReset();
  mocks.broadcastNotification.mockReset();
  mocks.trigger.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("publishNotification", () => {
  it("usa el bus SSE cuando Pusher no está configurado", async () => {
    stubPusherEnv(false);
    const { publishNotification } = await loadRealtime();

    await publishNotification(baseEvent);

    expect(mocks.broadcastNotification).toHaveBeenCalledWith(baseEvent);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("envía a cada admin activo salvo al actor y sigue aunque un trigger falle", async () => {
    stubPusherEnv(true);
    mocks.userFindMany.mockResolvedValue([
      { id: "admin_1" },
      { id: "admin_2" },
      { id: ACTOR_ID },
    ]);
    mocks.trigger.mockImplementation(async (channel: string) => {
      if (channel === "private-user-admin_1") {
        throw new Error("pusher unavailable");
      }
    });
    const { publishNotification } = await loadRealtime();

    await expect(publishNotification(baseEvent)).resolves.toBeUndefined();

    expect(mocks.trigger).toHaveBeenCalledTimes(2);
    expect(mocks.trigger).toHaveBeenCalledWith("private-user-admin_2", NOTIFICATION_EVENT, baseEvent);
    expect(mocks.trigger).not.toHaveBeenCalledWith(`private-user-${ACTOR_ID}`, NOTIFICATION_EVENT, baseEvent);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("resuelve el usuario vinculado al cliente para eventos CUSTOMER", async () => {
    stubPusherEnv(true);
    mocks.customerFindUnique.mockResolvedValue({ userId: "user_customer" });
    const { publishNotification } = await loadRealtime();

    await publishNotification({ ...baseEvent, recipientRole: "CUSTOMER" });

    expect(mocks.customerFindUnique).toHaveBeenCalledWith({
      where: { id: "cus_1" },
      select: { userId: true },
    });
    expect(mocks.trigger).toHaveBeenCalledWith(
      "private-user-user_customer",
      NOTIFICATION_EVENT,
      expect.objectContaining({ id: "notif_1" })
    );
  });

  it("envía directamente al técnico y avisa si falta recipientUserId", async () => {
    stubPusherEnv(true);
    const { publishNotification } = await loadRealtime();

    await publishNotification({ ...baseEvent, recipientRole: "TECH", recipientUserId: "user_tech" });
    await publishNotification({ ...baseEvent, recipientRole: "TECH", recipientUserId: null });

    expect(mocks.trigger).toHaveBeenCalledTimes(1);
    expect(mocks.trigger).toHaveBeenCalledWith(
      "private-user-user_tech",
      NOTIFICATION_EVENT,
      expect.objectContaining({ recipientRole: "TECH" })
    );
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("nunca relanza si la consulta de destinatarios falla", async () => {
    stubPusherEnv(true);
    mocks.userFindMany.mockRejectedValue(new Error("db down"));
    const { publishNotification } = await loadRealtime();

    await expect(publishNotification(baseEvent)).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
});
