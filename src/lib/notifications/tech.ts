import type { Prisma } from "@prisma/client";

/**
 * Destinatario TECH de una notificación.
 *
 * Se usa la columna `Notification.recipientUserId` (indexada). La migración
 * notification_recipient_column hizo backfill desde `payload.recipientUserId`, así que no hace
 * falta consultar el payload.
 */

/** Campos mínimos de una fila Notification para comprobar el destinatario TECH. */
export type TechRecipientRow = { recipientUserId: string | null };

export function isTechNotificationForUser(
  notification: TechRecipientRow,
  userId: string
) {
  return (
    notification.recipientUserId !== null &&
    notification.recipientUserId === userId
  );
}

export function filterTechNotificationsForUser<T extends TechRecipientRow>(
  items: readonly T[],
  userId: string
) {
  return items.filter((item) => isTechNotificationForUser(item, userId));
}

export function buildTechRecipientWhere(
  userId: string
): Prisma.NotificationWhereInput {
  return { recipientUserId: userId };
}
