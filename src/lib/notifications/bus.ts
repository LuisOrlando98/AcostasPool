import type { NotificationSeverity, Role } from "@prisma/client";

export type NotificationEventPayload = {
  id: string;
  eventType: string;
  recipientRole: Role;
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

export function broadcastNotification(event: NotificationEventPayload) {
  for (const subscriber of subscribers.values()) {
    if (subscriber.role !== event.recipientRole) {
      continue;
    }
    if (
      subscriber.role === "ADMIN" &&
      event.actorUserId &&
      event.actorUserId === subscriber.userId
    ) {
      continue;
    }
    if (
      subscriber.role === "CUSTOMER" &&
      subscriber.customerId &&
      event.customerId &&
      subscriber.customerId !== event.customerId
    ) {
      continue;
    }
    if (
      subscriber.allowedEventTypes &&
      !subscriber.allowedEventTypes.has(event.eventType)
    ) {
      continue;
    }
    subscriber.send(event);
  }
}
