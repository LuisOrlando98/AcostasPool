import type { Prisma } from "@prisma/client";

export function getTechRecipientUserId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const value = (payload as Record<string, unknown>).recipientUserId;
  return typeof value === "string" ? value : null;
}

export function isTechNotificationForUser(payload: unknown, userId: string) {
  return getTechRecipientUserId(payload) === userId;
}

export function buildTechRecipientWhere(userId: string): Prisma.NotificationWhereInput {
  return {
    payload: {
      path: ["recipientUserId"],
      equals: userId,
    },
  };
}
