import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Registro de auditoría.
 *
 * - Sin `tx`: escribe con el cliente global y NUNCA lanza (un fallo se registra con console.error);
 *   la operación de negocio no depende de la auditoría.
 * - Con `tx` (Prisma.TransactionClient): escribe dentro de la transacción del llamante y los
 *   errores SE PROPAGAN para que el llamante haga rollback. PostgreSQL aborta la transacción tras
 *   cualquier error, así que tragarlo aquí solo ocultaría la causa real del fallo del commit.
 *
 * `actorEmail` / `actorName` (columnas que sobreviven al borrado del usuario, AuditLog.userId es
 * SetNull): si el llamante no los pasa se resuelven leyendo User por `userId` con el mismo cliente
 * (tx o global); si el usuario no existe o la lectura falla quedan en null.
 *
 * Sin `userId` no se escribe nada (comportamiento previo conservado).
 */
type LogAuditEventInput = {
  userId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  tx?: Prisma.TransactionClient;
};

type ActorInfo = {
  actorEmail: string | null;
  actorName: string | null;
};

async function resolveActor(
  client: Prisma.TransactionClient,
  userId: string,
  provided: Pick<LogAuditEventInput, "actorEmail" | "actorName">
): Promise<ActorInfo> {
  if (provided.actorEmail !== undefined && provided.actorName !== undefined) {
    return { actorEmail: provided.actorEmail, actorName: provided.actorName };
  }
  try {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });
    return {
      actorEmail: provided.actorEmail ?? user?.email ?? null,
      actorName: provided.actorName ?? user?.fullName ?? null,
    };
  } catch (error) {
    console.error("Audit actor lookup failed:", error);
    return {
      actorEmail: provided.actorEmail ?? null,
      actorName: provided.actorName ?? null,
    };
  }
}

async function writeAuditLog(
  client: Prisma.TransactionClient,
  userId: string,
  input: LogAuditEventInput
) {
  const actor = await resolveActor(client, userId, input);
  await client.auditLog.create({
    data: {
      userId,
      actorEmail: actor.actorEmail,
      actorName: actor.actorName,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? undefined,
      metadata:
        input.metadata && Object.keys(input.metadata).length > 0
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined,
    },
  });
}

export async function logAuditEvent(input: LogAuditEventInput) {
  const { userId, tx } = input;
  if (!userId) {
    return;
  }

  if (tx) {
    await writeAuditLog(tx, userId, input);
    return;
  }

  try {
    await writeAuditLog(prisma, userId, input);
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}
