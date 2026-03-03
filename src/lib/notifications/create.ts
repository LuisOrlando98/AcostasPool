import type {
  NotificationSeverity,
  NotificationStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { publishNotification } from "@/lib/notifications/realtime";

type CreateNotificationInput = {
  customerId: string;
  recipientRole: Role;
  recipientUserId?: string | null;
  eventType: string;
  severity?: NotificationSeverity;
  status?: NotificationStatus;
  payload?: Record<string, unknown> | null;
  actorUserId?: string | null;
};

export async function createNotification({
  customerId,
  recipientRole,
  recipientUserId,
  eventType,
  severity = "INFO",
  status = "QUEUED",
  payload,
  actorUserId,
}: CreateNotificationInput) {
  if (recipientRole === "TECH" && !recipientUserId) {
    console.warn("Creating TECH notification without recipientUserId", {
      eventType,
      customerId,
    });
  }

  const normalizedPayload: Record<string, unknown> = payload
    ? { ...payload }
    : {};
  if (recipientUserId) {
    normalizedPayload.recipientUserId = recipientUserId;
  }

  const notification = await prisma.notification.create({
    data: {
      customerId,
      recipientRole,
      eventType,
      severity,
      status,
      payload:
        Object.keys(normalizedPayload).length > 0
          ? (normalizedPayload as Prisma.InputJsonValue)
          : undefined,
      actorUserId: actorUserId ?? undefined,
      channel: "EMAIL",
    },
  });
  const payloadValue =
    notification.payload && typeof notification.payload === "object"
      ? (notification.payload as Record<string, unknown>)
      : null;
  const resolvedRecipientUserId =
    payloadValue && typeof payloadValue.recipientUserId === "string"
      ? payloadValue.recipientUserId
      : null;

  await publishNotification({
    id: notification.id,
    eventType: notification.eventType,
    recipientRole: notification.recipientRole,
    recipientUserId: resolvedRecipientUserId,
    actorUserId: notification.actorUserId,
    customerId: notification.customerId,
    severity: notification.severity,
    createdAt: notification.createdAt.toISOString(),
  });

  return notification;
}
