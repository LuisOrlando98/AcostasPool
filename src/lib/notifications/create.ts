import type { NotificationSeverity, NotificationStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { publishNotification } from "@/lib/notifications/realtime";

type CreateNotificationInput = {
  customerId: string;
  recipientRole: Role;
  eventType: string;
  severity?: NotificationSeverity;
  status?: NotificationStatus;
  payload?: Record<string, unknown> | null;
  actorUserId?: string | null;
};

export async function createNotification({
  customerId,
  recipientRole,
  eventType,
  severity = "INFO",
  status = "QUEUED",
  payload,
  actorUserId,
}: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      customerId,
      recipientRole,
      eventType,
      severity,
      status,
      payload: payload ?? undefined,
      actorUserId: actorUserId ?? undefined,
      channel: "EMAIL",
    },
  });

  await publishNotification({
    id: notification.id,
    eventType: notification.eventType,
    recipientRole: notification.recipientRole,
    actorUserId: notification.actorUserId,
    customerId: notification.customerId,
    severity: notification.severity,
    createdAt: notification.createdAt.toISOString(),
  });

  return notification;
}
