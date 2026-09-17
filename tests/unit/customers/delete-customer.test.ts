import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteCustomerWithRelations,
  type DeleteCustomerDb,
} from "@/lib/customers/delete-customer";

const CUSTOMER_ID = "customer_1";
const USER_ID = "user_1";
const REMOVED_JOBS = 3;
const REMOVED_PLANS = 2;

const customerRecord = {
  id: CUSTOMER_ID,
  userId: USER_ID,
  email: "ana@example.com",
  nombre: "Ana",
  apellidos: "Perez",
};

function buildTx() {
  return {
    customer: {
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue(customerRecord),
    },
    job: { deleteMany: vi.fn().mockResolvedValue({ count: REMOVED_JOBS }) },
    servicePlan: { deleteMany: vi.fn().mockResolvedValue({ count: REMOVED_PLANS }) },
    user: { delete: vi.fn().mockResolvedValue({ id: USER_ID }) },
    auditLog: { deleteMany: vi.fn(), updateMany: vi.fn() },
    // Tablas que hoy se borraban a mano y ahora caen en cascada: no deben tocarse.
    property: { deleteMany: vi.fn() },
    invoice: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn(), updateMany: vi.fn() },
    customerDocument: { deleteMany: vi.fn() },
    emailLog: { deleteMany: vi.fn() },
    jobPhoto: { deleteMany: vi.fn() },
    techDigestItem: { deleteMany: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn() },
    notificationPreference: { deleteMany: vi.fn() },
  };
}

type Tx = ReturnType<typeof buildTx>;
type TransactionCallback = (tx: Tx) => Promise<unknown>;

function buildDb(tx: Tx) {
  const $transaction = vi.fn(async (callback: TransactionCallback) => callback(tx));
  return { db: { $transaction } as unknown as DeleteCustomerDb, $transaction };
}

function callOrder(tx: Tx) {
  const calls: Array<[string, number]> = [
    ["job.deleteMany", tx.job.deleteMany.mock.invocationCallOrder[0]],
    ["servicePlan.deleteMany", tx.servicePlan.deleteMany.mock.invocationCallOrder[0]],
    ["customer.delete", tx.customer.delete.mock.invocationCallOrder[0]],
    ["user.delete", tx.user.delete.mock.invocationCallOrder[0]],
  ];
  return calls
    .filter(([, order]) => order !== undefined)
    .sort((left, right) => left[1] - right[1])
    .map(([name]) => name);
}

let tx: Tx;

beforeEach(() => {
  tx = buildTx();
});

describe("deleteCustomerWithRelations", () => {
  it("devuelve null y no borra nada cuando el cliente no existe", async () => {
    // Arrange
    tx.customer.findUnique.mockResolvedValue(null);
    const { db, $transaction } = buildDb(tx);

    // Act
    const outcome = await deleteCustomerWithRelations(db, CUSTOMER_ID);

    // Assert
    expect(outcome).toBeNull();
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(tx.job.deleteMany).not.toHaveBeenCalled();
    expect(tx.servicePlan.deleteMany).not.toHaveBeenCalled();
    expect(tx.customer.delete).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("borra trabajos y planes antes que el cliente y después el usuario vinculado", async () => {
    // Arrange
    tx.customer.findUnique.mockResolvedValue(customerRecord);
    const { db } = buildDb(tx);

    // Act
    const outcome = await deleteCustomerWithRelations(db, CUSTOMER_ID);

    // Assert
    expect(callOrder(tx)).toEqual([
      "job.deleteMany",
      "servicePlan.deleteMany",
      "customer.delete",
      "user.delete",
    ]);
    expect(tx.job.deleteMany).toHaveBeenCalledWith({ where: { customerId: CUSTOMER_ID } });
    expect(tx.servicePlan.deleteMany).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID },
    });
    expect(tx.customer.delete).toHaveBeenCalledWith({ where: { id: CUSTOMER_ID } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: USER_ID } });
    expect(outcome).toEqual({
      customer: customerRecord,
      removedJobs: REMOVED_JOBS,
      removedPlans: REMOVED_PLANS,
      deletedUserId: USER_ID,
    });
  });

  it("no toca la auditoría ni las tablas que el esquema borra o desvincula en cascada", async () => {
    // Arrange
    tx.customer.findUnique.mockResolvedValue(customerRecord);
    const { db } = buildDb(tx);

    // Act
    await deleteCustomerWithRelations(db, CUSTOMER_ID);

    // Assert
    expect(tx.auditLog.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.updateMany).not.toHaveBeenCalled();
    for (const delegate of [
      tx.property,
      tx.invoice,
      tx.customerDocument,
      tx.emailLog,
      tx.jobPhoto,
      tx.techDigestItem,
      tx.passwordResetToken,
      tx.notificationPreference,
    ]) {
      expect(delegate.deleteMany).not.toHaveBeenCalled();
    }
    expect(tx.notification.deleteMany).not.toHaveBeenCalled();
    expect(tx.notification.updateMany).not.toHaveBeenCalled();
  });

  it("omite el borrado de usuario cuando el cliente no tiene portal vinculado", async () => {
    // Arrange
    tx.customer.findUnique.mockResolvedValue({ ...customerRecord, userId: null });
    const { db } = buildDb(tx);

    // Act
    const outcome = await deleteCustomerWithRelations(db, CUSTOMER_ID);

    // Assert
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(outcome?.deletedUserId).toBeNull();
    expect(outcome?.customer.userId).toBeNull();
  });

  it("propaga el error de la transacción sin tragarlo", async () => {
    // Arrange
    tx.customer.findUnique.mockResolvedValue(customerRecord);
    tx.customer.delete.mockRejectedValue(new Error("FK violation"));
    const { db } = buildDb(tx);

    // Act & Assert
    await expect(deleteCustomerWithRelations(db, CUSTOMER_ID)).rejects.toThrow(
      "FK violation"
    );
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
});
