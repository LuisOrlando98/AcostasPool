import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type LogAuditEventInput = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAuditEvent({
  userId,
  action,
  entity,
  entityId,
  metadata,
}: LogAuditEventInput) {
  if (!userId) {
    return;
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ?? undefined,
        metadata:
          metadata && Object.keys(metadata).length > 0
            ? (metadata as Prisma.InputJsonValue)
            : undefined,
      },
    });
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}
