import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { buildTechRecipientWhere } from "@/lib/notifications/tech";

/**
 * Estados que "Limpiar" puede borrar en la bandeja de un cliente.
 *
 * Las filas QUEUED y PROCESSING son la cola de correo del worker
 * (src/lib/worker/customer-notifications.ts, que reclama exactamente
 * `recipientRole: "CUSTOMER"` + `channel: "EMAIL"` en estado QUEUED): borrarlas
 * cancelaría en silencio un aviso que el cliente todavía no ha recibido.
 * Toda notificación de cliente acaba en SENT o FAILED —el worker cierra
 * SERVICE_SCHEDULED, SERVICE_RESCHEDULED y JOB_COMPLETED, e INVOICE_SENT nace ya
 * con estado definitivo—, así que el filtro no deja nada fuera de su alcance.
 *
 * ADMIN y TECH conservan su semántica a propósito: ningún worker envía sus
 * filas, que se quedan en el QUEUED con el que nacen (`createNotification`), y
 * filtrarlas por estado dejaría su "Limpiar" sin efecto.
 */
const CLEARABLE_CUSTOMER_STATUSES = ["SENT", "FAILED"] as const;

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "ADMIN") {
    const { allowed, disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const filtered = allowed.filter((eventType) => !disabled.has(eventType));
    if (filtered.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }
    const result = await prisma.notification.deleteMany({
      where: {
        eventType: { in: filtered },
        recipientRole: "ADMIN",
        OR: [{ actorUserId: null }, { actorUserId: { not: session.sub } }],
      },
    });
    return NextResponse.json({ ok: true, count: result.count });
  }

  if (session.role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({
      where: { userId: session.sub },
    });
    if (!customer) {
      return NextResponse.json({ ok: true, count: 0 });
    }
    const { disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const result = await prisma.notification.deleteMany({
      where: {
        customerId: customer.id,
        recipientRole: "CUSTOMER",
        status: { in: [...CLEARABLE_CUSTOMER_STATUSES] },
        ...(disabled.size > 0 ? { eventType: { notIn: [...disabled] } } : {}),
      },
    });
    return NextResponse.json({ ok: true, count: result.count });
  }

  if (session.role === "TECH") {
    const { disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const result = await prisma.notification.deleteMany({
      where: {
        recipientRole: "TECH",
        AND: buildTechRecipientWhere(session.sub),
        ...(disabled.size > 0 ? { eventType: { notIn: [...disabled] } } : {}),
      },
    });
    return NextResponse.json({ ok: true, count: result.count });
  }

  return NextResponse.json({ ok: true, count: 0 });
}
