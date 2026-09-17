import type {
  Notification,
  NotificationSeverity,
  NotificationStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import type { NotificationEventPayload } from "@/lib/notifications/bus";
import { publishNotification } from "@/lib/notifications/realtime";

/**
 * Creación de notificaciones.
 *
 * Sin transacción: crea la fila, publica en tiempo real y devuelve la fila.
 *
 *   const notification = await createNotification({
 *     customerId, recipientRole: "CUSTOMER", eventType: "SERVICE_SCHEDULED",
 *   });
 *
 * Dentro de una transacción del llamante (`tx`): la fila se escribe con `tx` y la publicación en
 * tiempo real se DIFIERE. Se devuelve `{ notification, publish }` y el llamante invoca `publish()`
 * después del commit, nunca dentro del callback de `$transaction` (un suscriptor podría recibir
 * un evento de una fila que luego se revierte).
 *
 *   const created = await prisma.$transaction((tx) => createNotification({ ...input, tx }));
 *   await created.publish();
 *
 * La publicación en tiempo real (Pusher o el bus SSE de respaldo) nunca relanza: un fallo se
 * registra con console.error y la operación de negocio continúa.
 */

export type CreateNotificationInput = {
  /** Cliente asociado. Opcional para ADMIN/TECH sin cliente; para CUSTOMER debería indicarse. */
  customerId?: string | null;
  recipientRole: Role;
  recipientUserId?: string | null;
  eventType: string;
  severity?: NotificationSeverity;
  status?: NotificationStatus;
  payload?: Record<string, unknown> | null;
  actorUserId?: string | null;
};

export type DeferredNotification = {
  notification: Notification;
  /** Publica el evento en tiempo real. Llamar tras el commit. Nunca lanza. */
  publish: () => Promise<void>;
};

const DEFAULT_SEVERITY: NotificationSeverity = "INFO";
const DEFAULT_STATUS: NotificationStatus = "QUEUED";

export function toNotificationEvent(
  notification: Notification
): NotificationEventPayload {
  return {
    id: notification.id,
    eventType: notification.eventType,
    recipientRole: notification.recipientRole,
    recipientUserId: notification.recipientUserId,
    actorUserId: notification.actorUserId,
    customerId: notification.customerId,
    severity: notification.severity,
    createdAt: notification.createdAt.toISOString(),
  };
}

/** Publica en tiempo real aislando cualquier fallo del canal (nunca lanza). */
export async function publishNotificationSafely(
  notification: Notification
): Promise<void> {
  try {
    await publishNotification(toNotificationEvent(notification));
  } catch (error) {
    console.error("Realtime publish failed for notification", {
      notificationId: notification.id,
      eventType: notification.eventType,
      error,
    });
  }
}

function warnOnMissingRecipient(input: CreateNotificationInput) {
  if (input.recipientRole === "TECH" && !input.recipientUserId) {
    console.warn("Creating TECH notification without recipientUserId", {
      eventType: input.eventType,
      customerId: input.customerId ?? null,
    });
  }
  if (input.recipientRole === "CUSTOMER" && !input.customerId) {
    console.warn("Creating CUSTOMER notification without customerId", {
      eventType: input.eventType,
    });
  }
}

function buildNotificationData(
  input: CreateNotificationInput
): Prisma.NotificationUncheckedCreateInput {
  // recipientUserId se guarda en su columna y se conserva en payload por compatibilidad
  // con lectores anteriores durante esta versión.
  const payload: Record<string, unknown> = {
    ...(input.payload ?? {}),
    ...(input.recipientUserId ? { recipientUserId: input.recipientUserId } : {}),
  };
  return {
    customerId: input.customerId ?? null,
    recipientUserId: input.recipientUserId ?? null,
    recipientRole: input.recipientRole,
    eventType: input.eventType,
    severity: input.severity ?? DEFAULT_SEVERITY,
    status: input.status ?? DEFAULT_STATUS,
    payload:
      Object.keys(payload).length > 0
        ? (payload as Prisma.InputJsonValue)
        : undefined,
    actorUserId: input.actorUserId ?? undefined,
    channel: "EMAIL",
  };
}

export async function createNotification(
  input: CreateNotificationInput & { tx: Prisma.TransactionClient }
): Promise<DeferredNotification>;
export async function createNotification(
  input: CreateNotificationInput & { tx?: undefined }
): Promise<Notification>;
export async function createNotification(
  input: CreateNotificationInput & { tx?: Prisma.TransactionClient }
): Promise<Notification | DeferredNotification> {
  const { tx, ...fields } = input;
  warnOnMissingRecipient(fields);

  const client: Prisma.TransactionClient = tx ?? prisma;
  const notification = await client.notification.create({
    data: buildNotificationData(fields),
  });

  if (tx) {
    return {
      notification,
      publish: () => publishNotificationSafely(notification),
    };
  }

  await publishNotificationSafely(notification);
  return notification;
}
