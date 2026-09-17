import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  broadcastNotification,
  subscribe,
  type NotificationEventPayload,
} from "@/lib/notifications/bus";

const TECH_USER_ID = "user_tech";
const ADMIN_USER_ID = "user_admin";
const CUSTOMER_ID = "cus_1";

const techEvent: NotificationEventPayload = {
  id: "notif_1",
  eventType: "ROUTE_UPDATED",
  recipientRole: "TECH",
  recipientUserId: TECH_USER_ID,
  actorUserId: ADMIN_USER_ID,
  customerId: CUSTOMER_ID,
  severity: "INFO",
  createdAt: "2026-09-17T10:00:00.000Z",
};

let unsubscribers: Array<() => void> = [];

const register = (subscriber: Parameters<typeof subscribe>[0]) => {
  unsubscribers = [...unsubscribers, subscribe(subscriber)];
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
  vi.restoreAllMocks();
});

describe("broadcastNotification", () => {
  it("sigue entregando al resto de suscriptores cuando uno lanza y nunca relanza", () => {
    const received = vi.fn();
    register({
      id: "broken",
      role: "TECH",
      userId: TECH_USER_ID,
      send: () => {
        throw new Error("stream closed");
      },
    });
    register({ id: "healthy", role: "TECH", userId: TECH_USER_ID, send: received });

    expect(() => broadcastNotification(techEvent)).not.toThrow();

    expect(received).toHaveBeenCalledWith(techEvent);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("no entrega eventos TECH sin destinatario ni a otros usuarios TECH", () => {
    const sameUser = vi.fn();
    const otherUser = vi.fn();
    register({ id: "same", role: "TECH", userId: TECH_USER_ID, send: sameUser });
    register({ id: "other", role: "TECH", userId: "user_other", send: otherUser });

    broadcastNotification(techEvent);
    broadcastNotification({ ...techEvent, recipientUserId: null });

    expect(sameUser).toHaveBeenCalledTimes(1);
    expect(otherUser).not.toHaveBeenCalled();
  });

  it("omite al admin que originó el evento y respeta los tipos permitidos", () => {
    const actor = vi.fn();
    const otherAdmin = vi.fn();
    const filteredAdmin = vi.fn();
    register({ id: "actor", role: "ADMIN", userId: ADMIN_USER_ID, send: actor });
    register({ id: "admin2", role: "ADMIN", userId: "user_admin_2", send: otherAdmin });
    register({
      id: "admin3",
      role: "ADMIN",
      userId: "user_admin_3",
      allowedEventTypes: new Set(["JOB_COMPLETED"]),
      send: filteredAdmin,
    });

    broadcastNotification({
      ...techEvent,
      recipientRole: "ADMIN",
      recipientUserId: null,
      eventType: "CUSTOMER_REQUEST",
    });

    expect(actor).not.toHaveBeenCalled();
    expect(otherAdmin).toHaveBeenCalledTimes(1);
    expect(filteredAdmin).not.toHaveBeenCalled();
  });

  it("entrega a clientes solo cuando el customerId coincide", () => {
    const sameCustomer = vi.fn();
    const otherCustomer = vi.fn();
    const unlinked = vi.fn();
    register({
      id: "c1",
      role: "CUSTOMER",
      userId: "user_c1",
      customerId: CUSTOMER_ID,
      send: sameCustomer,
    });
    register({
      id: "c2",
      role: "CUSTOMER",
      userId: "user_c2",
      customerId: "cus_2",
      send: otherCustomer,
    });
    register({ id: "c3", role: "CUSTOMER", userId: "user_c3", send: unlinked });

    broadcastNotification({
      ...techEvent,
      recipientRole: "CUSTOMER",
      recipientUserId: null,
    });

    expect(sameCustomer).toHaveBeenCalledTimes(1);
    expect(otherCustomer).not.toHaveBeenCalled();
    expect(unlinked).not.toHaveBeenCalled();
  });
});
