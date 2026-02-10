import type { NotificationEventPayload } from "@/lib/notifications/bus";
import { broadcastNotification } from "@/lib/notifications/bus";
import { prisma } from "@/lib/db";
import type Pusher from "pusher";

let pusherClient: Pusher | null = null;

const getPusher = () => {
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

  const PusherLib = require("pusher") as typeof Pusher;
  pusherClient = new PusherLib({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherClient;
};

async function triggerForUser(userId: string, payload: NotificationEventPayload) {
  const client = getPusher();
  if (!client) {
    return false;
  }
  await client.trigger(`private-user-${userId}`, "notification", payload);
  return true;
}

export async function publishNotification(payload: NotificationEventPayload) {
  const client = getPusher();
  if (!client) {
    broadcastNotification(payload);
    return;
  }

  if (payload.recipientRole === "ADMIN") {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    await Promise.all(
      admins
        .filter((admin) => admin.id !== payload.actorUserId)
        .map((admin) => triggerForUser(admin.id, payload))
    );
    return;
  }

  if (payload.recipientRole === "CUSTOMER") {
    if (payload.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: payload.customerId },
        select: { userId: true },
      });
      if (customer?.userId) {
        await triggerForUser(customer.userId, payload);
      }
    }
    return;
  }

  if (payload.recipientRole === "TECH") {
    // Placeholder for future tech notifications.
    if (payload.actorUserId) {
      await triggerForUser(payload.actorUserId, payload);
    }
    return;
  }
}
