import type { NotificationSeverity, Role } from "@prisma/client";

export type NotificationEventPayload = {
  id: string;
  eventType: string;
  recipientRole: Role;
  recipientUserId?: string | null;
  actorUserId?: string | null;
  customerId?: string | null;
  severity: NotificationSeverity;
  createdAt: string;
};

type Subscriber = {
  id: string;
  role: Role;
  userId: string;
  customerId?: string | null;
  allowedEventTypes?: Set<string>;
  send: (payload: NotificationEventPayload) => void;
};

const subscribers = new Map<string, Subscriber>();

export function subscribe(subscriber: Subscriber) {
  subscribers.set(subscriber.id, subscriber);
  return () => {
    subscribers.delete(subscriber.id);
  };
}

function isRecipient(subscriber: Subscriber, event: NotificationEventPayload) {
  if (subscriber.role !== event.recipientRole) {
    return false;
  }
  if (subscriber.role === "TECH" && !event.recipientUserId) {
    return false;
  }
  if (event.recipientUserId && subscriber.userId !== event.recipientUserId) {
    return false;
  }
  if (
    subscriber.role === "ADMIN" &&
    event.actorUserId &&
    event.actorUserId === subscriber.userId
  ) {
    return false;
  }
  if (
    subscriber.role === "CUSTOMER" &&
    (!subscriber.customerId ||
      !event.customerId ||
      subscriber.customerId !== event.customerId)
  ) {
    return false;
  }
  if (
    subscriber.allowedEventTypes &&
    !subscriber.allowedEventTypes.has(event.eventType)
  ) {
    return false;
  }
  return true;
}

function deliver(subscriber: Subscriber, event: NotificationEventPayload) {
  try {
    subscriber.send(event);
  } catch (error) {
    // Un stream ya cerrado (controller.enqueue lanza) no debe impedir la entrega al resto.
    console.error("Notification stream delivery failed", {
      subscriberId: subscriber.id,
      notificationId: event.id,
      error,
    });
  }
}

/**
 * Entrega el evento a los suscriptores SSE que correspondan (respaldo cuando no hay Pusher).
 * Nunca lanza: un suscriptor roto se registra y se continúa con los demás.
 */
export function broadcastNotification(event: NotificationEventPayload) {
  for (const subscriber of subscribers.values()) {
    if (isRecipient(subscriber, event)) {
      deliver(subscriber, event);
    }
  }
}
