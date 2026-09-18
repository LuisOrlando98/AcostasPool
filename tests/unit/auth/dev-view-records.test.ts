import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  technician: { upsert: vi.fn() },
  customer: { upsert: vi.fn() },
  property: { findFirst: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: dbMock }));

import {
  DEV_TEST_CUSTOMER_SURNAME,
  DEV_TEST_PROPERTY_ADDRESS,
  DEV_TEST_PROPERTY_NAME,
  DEV_TEST_RECORD_NOTES,
  ensureDeveloperCustomer,
  ensureDeveloperTechnician,
} from "@/lib/auth/dev-view-records";

const DEVELOPER_ID = "user-dev";
const DEVELOPER_EMAIL = "luiso.rodriguezcabrera@gmail.com";
const TECHNICIAN_ID = "technician-dev";
const CUSTOMER_ID = "customer-dev";
const PROPERTY_ID = "property-dev";

const developerUser = {
  email: DEVELOPER_EMAIL,
  fullName: "Dev Principal",
  locale: "ES",
};

beforeEach(() => {
  dbMock.user.findUnique.mockReset().mockResolvedValue(developerUser);
  dbMock.technician.upsert.mockReset().mockResolvedValue({ id: TECHNICIAN_ID });
  dbMock.customer.upsert.mockReset().mockResolvedValue({ id: CUSTOMER_ID });
  dbMock.property.findFirst.mockReset().mockResolvedValue(null);
  dbMock.property.create.mockReset().mockResolvedValue({ id: PROPERTY_ID });
});

describe("ensureDeveloperTechnician", () => {
  it("creates the technician row linked to the developer and marked as a test row", async () => {
    const record = await ensureDeveloperTechnician(DEVELOPER_ID);

    expect(record).toEqual({ technicianId: TECHNICIAN_ID });
    expect(dbMock.technician.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: DEVELOPER_ID },
        create: expect.objectContaining({
          userId: DEVELOPER_ID,
          notes: DEV_TEST_RECORD_NOTES,
          colorHex: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        }),
        update: {},
      })
    );
  });

  it("reuses an existing row without overwriting it", async () => {
    dbMock.technician.upsert.mockResolvedValue({ id: "technician-existing" });

    const record = await ensureDeveloperTechnician(DEVELOPER_ID);

    expect(record).toEqual({ technicianId: "technician-existing" });
    expect(dbMock.technician.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} })
    );
  });
});

describe("ensureDeveloperCustomer", () => {
  it("creates the customer from the developer account and its test property", async () => {
    const record = await ensureDeveloperCustomer(DEVELOPER_ID);

    expect(record).toEqual({ customerId: CUSTOMER_ID, propertyId: PROPERTY_ID });
    expect(dbMock.customer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: DEVELOPER_ID },
        create: expect.objectContaining({
          userId: DEVELOPER_ID,
          nombre: developerUser.fullName,
          apellidos: DEV_TEST_CUSTOMER_SURNAME,
          email: DEVELOPER_EMAIL,
          idiomaPreferencia: "ES",
          estadoCuenta: "ACTIVE",
          tipoCliente: "RESIDENTIAL",
          notas: DEV_TEST_RECORD_NOTES,
        }),
        update: {},
      })
    );
    expect(dbMock.property.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: CUSTOMER_ID,
          name: DEV_TEST_PROPERTY_NAME,
          address: DEV_TEST_PROPERTY_ADDRESS,
        }),
      })
    );
  });

  it("follows the locale stored on the developer account", async () => {
    dbMock.user.findUnique.mockResolvedValue({ ...developerUser, locale: "EN" });

    await ensureDeveloperCustomer(DEVELOPER_ID);

    expect(dbMock.customer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ idiomaPreferencia: "EN" }),
      })
    );
  });

  it("reuses the existing test property instead of creating another one", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: "property-existing" });

    const record = await ensureDeveloperCustomer(DEVELOPER_ID);

    expect(record).toEqual({
      customerId: CUSTOMER_ID,
      propertyId: "property-existing",
    });
    expect(dbMock.property.create).not.toHaveBeenCalled();
  });

  it("throws when the developer account no longer exists", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);

    await expect(ensureDeveloperCustomer(DEVELOPER_ID)).rejects.toThrow(DEVELOPER_ID);
    expect(dbMock.customer.upsert).not.toHaveBeenCalled();
  });
});
