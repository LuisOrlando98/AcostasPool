import type { NotificationEventPayload } from "@/lib/notifications/bus";
import { broadcastNotification } from "@/lib/notifications/bus";
import { prisma } from "@/lib/db";
import Pusher from "pusher";

const USER_CHANNEL_PREFIX = "private-user-";
const NOTIFICATION_EVENT_NAME = "notification";

let pusherClient: Pusher | null = null;

export const getPusher = () => {
  if (pusherClient) {
    return pusherClient;
  }

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    return null;
  }

  pusherClient = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherClient;
};

async function resolveRecipientUserIds(
  payload: NotificationEventPayload
): Promise<string[]> {
  if (payload.recipientRole === "ADMIN") {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    return admins
      .map((admin) => admin.id)
      .filter((adminId) => adminId !== payload.actorUserId);
  }

  if (payload.recipientRole === "CUSTOMER") {
    if (!payload.customerId) {
      return [];
    }
    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
      select: { userId: true },
    });
    return customer?.userId ? [customer.userId] : [];
  }

  if (!payload.recipientUserId) {
    console.warn("TECH notification skipped: missing recipientUserId", {
      notificationId: payload.id,
      eventType: payload.eventType,
    });
    return [];
  }
  return [payload.recipientUserId];
}

async function triggerForUsers(
  client: Pusher,
  userIds: readonly string[],
  payload: NotificationEventPayload
) {
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      client.trigger(`${USER_CHANNEL_PREFIX}${userId}`, NOTIFICATION_EVENT_NAME, payload)
    )
  );
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("Realtime notification trigger failed", {
        notificationId: payload.id,
        userId: userIds[index],
        error: result.reason,
      });
    }
  });
}

/**
 * Publica una notificación en tiempo real (Pusher, o el bus SSE si Pusher no está configurado).
 *
 * Nunca lanza: los fallos del canal (Pusher caído, error al resolver destinatarios) se registran
 * con console.error y se aísla cada destinatario, de modo que un trigger fallido no impide los
 * demás ni rompe la operación de negocio que originó la notificación.
 */
export async function publishNotification(
  payload: NotificationEventPayload
): Promise<void> {
  try {
    const client = getPusher();
    if (!client) {
      broadcastNotification(payload);
      return;
    }
    const userIds = await resolveRecipientUserIds(payload);
    await triggerForUsers(client, userIds, payload);
  } catch (error) {
    console.error("Realtime notification publish failed", {
      notificationId: payload.id,
      eventType: payload.eventType,
      error,
    });
  }
}
