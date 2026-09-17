import type { PrismaClient } from "@prisma/client";

/** Solo se necesita `$transaction`: facilita inyectar un doble en los tests. */
export type DeleteCustomerDb = Pick<PrismaClient, "$transaction">;

export type DeletedCustomerSummary = {
  id: string;
  userId: string | null;
  email: string;
  nombre: string;
  apellidos: string;
};

export type DeleteCustomerOutcome = {
  customer: DeletedCustomerSummary;
  removedJobs: number;
  removedPlans: number;
  deletedUserId: string | null;
};

const DELETED_CUSTOMER_SELECT = {
  id: true,
  userId: true,
  email: true,
  nombre: true,
  apellidos: true,
} as const;

/**
 * Elimina un cliente y su usuario del portal apoyándose en las reglas onDelete
 * del esquema (migración `on_delete_rules`):
 *
 * - Job y ServicePlan se borran primero de forma explícita porque su relación
 *   con Property es `Restrict`: la cascada Customer -> Property fallaría si
 *   aún existieran. Al borrar los Job caen en cascada JobPhoto y
 *   TechDigestItem, e Invoice/EmailLog quedan con `jobId` a null.
 * - Al borrar el Customer caen en cascada Property, Invoice, CustomerDocument,
 *   Notification y EmailLog.
 * - Al borrar el User caen en cascada PasswordResetToken y
 *   NotificationPreference; AuditLog, Notification.actorUserId,
 *   CustomerDocument.uploadedByUserId y Job.requestedByUserId pasan a null.
 *
 * Nunca toca AuditLog: la auditoría sobrevive con `userId` a null.
 *
 * Devuelve null si el cliente no existe.
 */
export async function deleteCustomerWithRelations(
  db: DeleteCustomerDb,
  customerId: string
): Promise<DeleteCustomerOutcome | null> {
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: DELETED_CUSTOMER_SELECT,
    });
    if (!customer) {
      return null;
    }

    const removedJobs = await tx.job.deleteMany({ where: { customerId } });
    const removedPlans = await tx.servicePlan.deleteMany({ where: { customerId } });
    await tx.customer.delete({ where: { id: customerId } });

    if (customer.userId) {
      await tx.user.delete({ where: { id: customer.userId } });
    }

    return {
      customer,
      removedJobs: removedJobs.count,
      removedPlans: removedPlans.count,
      deletedUserId: customer.userId,
    };
  });
}
