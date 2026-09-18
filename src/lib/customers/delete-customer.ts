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

/** Registros financieros que el esquema protege con `onDelete: Restrict`. */
export type CustomerFinancialRecordCounts = {
  contracts: number;
  payments: number;
  memberships: number;
};

/**
 * El cliente tiene contratos de servicio, pagos o membresías. Son registros
 * contables: el esquema los declara `Restrict` para que no desaparezcan con el
 * cliente, así que el borrado se aborta entero (la transacción no llega a
 * tocar nada) y el admin debe desactivar la cuenta en su lugar.
 */
export class CustomerHasFinancialRecordsError extends Error {
  readonly counts: CustomerFinancialRecordCounts;

  constructor(counts: CustomerFinancialRecordCounts) {
    super(
      `Customer has financial records: ${counts.contracts} contracts, ` +
        `${counts.payments} payments, ${counts.memberships} memberships`
    );
    this.name = "CustomerHasFinancialRecordsError";
    this.counts = counts;
  }
}

export function hasFinancialRecords(counts: CustomerFinancialRecordCounts) {
  return counts.contracts > 0 || counts.payments > 0 || counts.memberships > 0;
}

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
 * - ServiceContract, Payment y Membership son `Restrict`: si el cliente tiene
 *   alguno se lanza `CustomerHasFinancialRecordsError` y no se borra nada.
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

    const [contracts, payments, memberships] = await Promise.all([
      tx.serviceContract.count({ where: { customerId } }),
      tx.payment.count({ where: { customerId } }),
      tx.membership.count({ where: { customerId } }),
    ]);
    const counts: CustomerFinancialRecordCounts = {
      contracts,
      payments,
      memberships,
    };
    if (hasFinancialRecords(counts)) {
      throw new CustomerHasFinancialRecordsError(counts);
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
