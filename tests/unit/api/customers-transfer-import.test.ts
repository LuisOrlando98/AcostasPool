import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/developer/customers-transfer/import/route";
import { CUSTOMER_TRANSFER_FORMAT } from "@/lib/customers/transfer";

const dbMock = vi.hoisted(() => {
  const tx = {
    customer: { create: vi.fn() },
    user: { update: vi.fn() },
    property: { create: vi.fn() },
  };
  return {
    tx,
    customer: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
});
const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }));
const auditMock = vi.hoisted(() => ({ logAuditEvent: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    customer: dbMock.customer,
    user: dbMock.user,
    $transaction: dbMock.$transaction,
  },
}));
vi.mock("@/lib/auth/session", () => sessionMock);
vi.mock("@/lib/audit/log", () => auditMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/routing/address", () => ({
  normalizePropertyAddress: vi.fn(async (address: string) =>
    address.trim().replace(/\s+/g, " ")
  ),
}));

const IMPORT_URL =
  "http://localhost/api/admin/developer/customers-transfer/import";
const DEVELOPER_SESSION = { sub: "dev-user", isDeveloper: true };
const NEW_CUSTOMER_ID = "customer-new";
const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  customer: { select: { id: true } },
};

type TransactionCallback = (tx: typeof dbMock.tx) => Promise<unknown>;

function importRequest(payload: string) {
  const formData = new FormData();
  formData.set("payload", payload);
  return new Request(IMPORT_URL, { method: "POST", body: formData });
}

async function postImport(customers: unknown[]) {
  const response = await POST(
    importRequest(JSON.stringify({ format: CUSTOMER_TRANSFER_FORMAT, customers }))
  );
  return { status: response.status, body: await response.json() };
}

function summaryOf(totalEntries: number, overrides: Record<string, number> = {}) {
  return {
    totalEntries,
    createdCustomers: 0,
    skippedCustomers: 0,
    createdProperties: 0,
    skippedProperties: 0,
    errorCount: 0,
    ...overrides,
  };
}

function lookupCalls() {
  return [...dbMock.customer.findMany.mock.calls, ...dbMock.user.findMany.mock.calls];
}

describe("POST /api/admin/developer/customers-transfer/import", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionMock.getSession.mockReset().mockResolvedValue(DEVELOPER_SESSION);
    auditMock.logAuditEvent.mockReset().mockResolvedValue(undefined);
    dbMock.customer.findMany.mockReset().mockResolvedValue([]);
    dbMock.user.findMany.mockReset().mockResolvedValue([]);
    dbMock.tx.customer.create.mockReset().mockResolvedValue({ id: NEW_CUSTOMER_ID });
    dbMock.tx.user.update.mockReset().mockResolvedValue({});
    dbMock.tx.property.create.mockReset().mockResolvedValue({});
    dbMock.$transaction
      .mockReset()
      .mockImplementation((callback: TransactionCallback) => callback(dbMock.tx));
  });

  it("returns 401 when the session does not belong to a developer", async () => {
    sessionMock.getSession.mockResolvedValue({ sub: "admin", isDeveloper: false });

    const { status, body } = await postImport([{ nombre: "Ana" }]);

    expect(status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(lookupCalls()).toHaveLength(0);
  });

  it("returns 400 when the payload is not valid JSON", async () => {
    const response = await POST(importRequest("{not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "El archivo no contiene JSON valido.",
    });
    expect(lookupCalls()).toHaveLength(0);
  });

  it("preloads existing records in bulk with normalized keys and creates the customer", async () => {
    const { status, body } = await postImport([
      {
        sourceCustomerId: "src-1",
        nombre: "Ana",
        apellidos: "Lopez",
        email: " Ana.Lopez@Example.COM ",
        properties: [{ address: "1 Main St" }, { address: " 1  main st " }],
      },
    ]);

    expect(status).toBe(200);
    expect(body).toEqual({
      ok: true,
      summary: summaryOf(1, {
        createdCustomers: 1,
        createdProperties: 1,
        skippedProperties: 1,
      }),
      issues: [],
    });
    expect(dbMock.customer.findMany).toHaveBeenCalledTimes(2);
    expect(dbMock.customer.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["src-1"] } },
      select: { id: true },
    });
    expect(dbMock.customer.findMany).toHaveBeenCalledWith({
      where: { email: { in: ["ana.lopez@example.com"] } },
      select: { email: true },
    });
    expect(dbMock.user.findMany).toHaveBeenCalledTimes(1);
    expect(dbMock.user.findMany).toHaveBeenCalledWith({
      where: { email: { in: ["ana.lopez@example.com"] } },
      select: USER_SELECT,
    });
    expect(JSON.stringify(lookupCalls())).not.toContain("insensitive");
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.tx.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        nombre: "Ana",
        apellidos: "Lopez",
        email: "ana.lopez@example.com",
      }),
    });
    expect(dbMock.tx.user.update).not.toHaveBeenCalled();
    expect(dbMock.tx.property.create).toHaveBeenCalledTimes(1);
    expect(dbMock.tx.property.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: NEW_CUSTOMER_ID,
        address: "1 Main St",
      }),
    });
    expect(auditMock.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "dev-user",
        action: "CUSTOMER_TRANSFER_IMPORTED",
      })
    );
  });

  it("skips customers that already exist by sourceCustomerId or by email without writing", async () => {
    dbMock.customer.findMany.mockImplementation(
      async (args: { where: { id?: unknown; email?: unknown } }) =>
        args.where.id ? [{ id: "src-existing" }] : [{ email: "bea@example.com" }]
    );

    const { status, body } = await postImport([
      { sourceCustomerId: "src-existing", nombre: "Ana" },
      { nombre: "Bea", email: "BEA@example.com" },
    ]);

    expect(status).toBe(200);
    expect(body).toEqual({
      ok: true,
      summary: summaryOf(2, { skippedCustomers: 2 }),
      issues: [],
    });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("links an existing CUSTOMER user and refreshes its profile", async () => {
    dbMock.user.findMany.mockResolvedValue([
      { id: "user-1", email: "carla@example.com", role: "CUSTOMER", customer: null },
    ]);

    const { body } = await postImport([
      {
        nombre: "Carla",
        apellidos: "Ruiz",
        email: "Carla@Example.com",
        idiomaPreferencia: "ES",
        estadoCuenta: "INACTIVE",
      },
    ]);

    expect(body).toEqual({
      ok: true,
      summary: summaryOf(1, { createdCustomers: 1 }),
      issues: [],
    });
    expect(dbMock.tx.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        email: "carla@example.com",
      }),
    });
    expect(dbMock.tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { fullName: "Carla Ruiz", locale: "ES", isActive: false },
    });
  });

  it("reports an error when the email belongs to a user with another role", async () => {
    dbMock.user.findMany.mockResolvedValue([
      { id: "user-2", email: "dana@example.com", role: "ADMIN", customer: null },
    ]);

    const { body } = await postImport([{ nombre: "Dana", email: "dana@example.com" }]);

    expect(body).toEqual({
      ok: true,
      summary: summaryOf(1, { errorCount: 1 }),
      issues: [
        {
          customer: "Dana",
          message: "El email ya esta asignado a un usuario de otro rol.",
        },
      ],
    });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("skips a user that already has a linked customer", async () => {
    dbMock.user.findMany.mockResolvedValue([
      {
        id: "user-3",
        email: "eva@example.com",
        role: "CUSTOMER",
        customer: { id: "customer-3" },
      },
    ]);

    const { body } = await postImport([{ nombre: "Eva", email: "eva@example.com" }]);

    expect(body).toEqual({
      ok: true,
      summary: summaryOf(1, { skippedCustomers: 1 }),
      issues: [],
    });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("reports in-file duplicates and sanitize errors in input order and dedupes lookup keys", async () => {
    const { body } = await postImport([
      { sourceCustomerId: "dup", nombre: "Fabio" },
      { sourceCustomerId: "dup", nombre: "Fabio Bis" },
      { apellidos: "SinNombre" },
      { nombre: "Gina", email: "gina@example.com" },
      { nombre: "Gina Bis", email: "GINA@EXAMPLE.COM" },
    ]);

    expect(body).toEqual({
      ok: true,
      summary: summaryOf(5, {
        createdCustomers: 2,
        skippedCustomers: 2,
        errorCount: 1,
      }),
      issues: [
        {
          customer: "Fabio Bis",
          message: "sourceCustomerId duplicado dentro del archivo.",
        },
        { customer: "SinNombre", message: "nombre es obligatorio." },
        { customer: "Gina Bis", message: "Email duplicado dentro del archivo." },
      ],
    });
    expect(dbMock.customer.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["dup"] } },
      select: { id: true },
    });
    expect(dbMock.customer.findMany).toHaveBeenCalledWith({
      where: { email: { in: ["gina@example.com"] } },
      select: { email: true },
    });
    expect(dbMock.user.findMany).toHaveBeenCalledWith({
      where: { email: { in: ["gina@example.com"] } },
      select: USER_SELECT,
    });
    expect(dbMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("does not query the database when no customer has sourceCustomerId or email", async () => {
    const { body } = await postImport([{ nombre: "Hugo" }]);

    expect(body).toEqual({
      ok: true,
      summary: summaryOf(1, { createdCustomers: 1 }),
      issues: [],
    });
    expect(lookupCalls()).toHaveLength(0);
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 500 without writing when the bulk lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    dbMock.customer.findMany.mockRejectedValue(new Error("db down"));

    const { status, body } = await postImport([
      { nombre: "Ivan", email: "ivan@example.com" },
    ]);

    expect(status).toBe(500);
    expect(body).toEqual({
      error: "No se pudieron consultar los clientes existentes.",
    });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(auditMock.logAuditEvent).not.toHaveBeenCalled();
  });
});
