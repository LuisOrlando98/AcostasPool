import { beforeEach, describe, expect, it, vi } from "vitest";

// El módulo de zona horaria lee el entorno en tiempo de import.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

class RedirectSentinel extends Error {
  constructor(public readonly url: string) {
    super(`redirect:${url}`);
  }
}

const dbMock = vi.hoisted(() => ({
  customer: { findUnique: vi.fn(), update: vi.fn() },
  user: { findFirst: vi.fn(), update: vi.fn() },
  property: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  job: { count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  servicePlan: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  serviceTier: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  serviceContract: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  membership: { findUnique: vi.fn(), findFirst: vi.fn() },
  $transaction: vi.fn(),
}));
const navigationMock = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectSentinel(url);
  }),
}));
// `unstable_cache` lo usa site-settings en tiempo de import: devuelve la función tal cual.
const cacheMock = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}));
const guardsMock = vi.hoisted(() => ({
  requireRole: vi.fn(async () => ({ sub: "admin_1", role: "ADMIN" })),
}));
const libMocks = vi.hoisted(() => ({
  logAuditEvent: vi.fn(),
  sendCustomerInvite: vi.fn(),
  normalizePropertyAddress: vi.fn(async (address: string) => address.trim()),
  deleteCustomerWithRelations: vi.fn(),
  materializeServicePlanJob: vi.fn(),
  queueJobScheduledNotifications: vi.fn(),
  countUpcomingPlanJobs: vi.fn(),
  deleteUpcomingPlanJobs: vi.fn(),
  revalidateAttentionPaths: vi.fn(),
  createNotification: vi.fn(),
  sendContractReadyEmail: vi.fn(async () => ({ ok: true as const })),
  sendMembershipStartEmail: vi.fn(async () => ({ ok: true as const })),
  cancelMembership: vi.fn(),
  applyFeeToMembership: vi.fn(),
  getCompanySignatureUrl: vi.fn(async () => null),
  loadCustomerForContract: vi.fn(),
  buildSnapshotFields: vi.fn(() => ({ customerNameSnapshot: "Ana Perez" })),
  customerLocale: vi.fn(() => "ES"),
  renderAndStoreContractPdf: vi.fn(),
  startOfCurrentPeriodMonth: vi.fn(() => new Date("2026-09-01T00:00:00.000Z")),
  storeSignatureDataUrl: vi.fn(async () => "/uploads/sign.png"),
}));

vi.mock("@/lib/db", () => ({ prisma: dbMock }));
vi.mock("next/navigation", () => navigationMock);
vi.mock("next/cache", () => cacheMock);
vi.mock("@/lib/auth/guards", () => guardsMock);
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: libMocks.logAuditEvent }));
vi.mock("@/lib/customers/invite", () => ({
  sendCustomerInvite: libMocks.sendCustomerInvite,
}));
vi.mock("@/lib/routing/address", () => ({
  normalizePropertyAddress: libMocks.normalizePropertyAddress,
}));
vi.mock("@/lib/customers/delete-customer", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/customers/delete-customer")
  >();
  return {
    ...actual,
    deleteCustomerWithRelations: libMocks.deleteCustomerWithRelations,
  };
});
vi.mock("@/lib/jobs/materialize", () => ({
  materializeServicePlanJob: libMocks.materializeServicePlanJob,
  queueJobScheduledNotifications: libMocks.queueJobScheduledNotifications,
  countUpcomingPlanJobs: libMocks.countUpcomingPlanJobs,
  deleteUpcomingPlanJobs: libMocks.deleteUpcomingPlanJobs,
}));
// Integraciones de contrato y autopago: fuera del alcance de estas pruebas.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));
vi.mock("@/i18n/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/lib/reports/revalidate", () => ({
  revalidateAttentionPaths: libMocks.revalidateAttentionPaths,
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: libMocks.createNotification,
}));
vi.mock("@/lib/contracts/notify", () => ({
  sendContractReadyEmail: libMocks.sendContractReadyEmail,
}));
vi.mock("@/lib/contracts/service", () => ({
  buildSnapshotFields: libMocks.buildSnapshotFields,
  customerLocale: libMocks.customerLocale,
  loadCustomerForContract: libMocks.loadCustomerForContract,
  renderAndStoreContractPdf: libMocks.renderAndStoreContractPdf,
  startOfCurrentPeriodMonth: libMocks.startOfCurrentPeriodMonth,
  storeSignatureDataUrl: libMocks.storeSignatureDataUrl,
}));
vi.mock("@/lib/payments/cancel", () => ({
  cancelMembership: libMocks.cancelMembership,
}));
vi.mock("@/lib/payments/notify", () => ({
  sendMembershipStartEmail: libMocks.sendMembershipStartEmail,
}));
vi.mock("@/lib/payments/fees", () => ({
  applyFeeToMembership: libMocks.applyFeeToMembership,
  computeMembershipFeeCents: (baseCents: number) => ({
    baseCents,
    feeCents: 0,
    totalCents: baseCents,
  }),
}));
vi.mock("@/lib/site-settings", () => ({
  getCompanySignatureUrl: libMocks.getCompanySignatureUrl,
}));

import {
  createJob,
  createProperty,
  deleteCustomer,
  deleteProperty,
  deletePropertyFormAction,
  inviteCustomer,
  toggleServicePlan,
  updateCustomer,
  updateProperty,
} from "@/app/admin/customers/[id]/actions";
import {
  applyMembershipFeeAction,
  generateServiceContract,
  sendServiceStartAction,
  updateContractedPlanAction,
  updateCustomerFinancials,
} from "@/app/admin/customers/[id]/finance-actions";
import {
  CUSTOMER_DETAIL_ERRORS,
  CUSTOMER_DETAIL_INLINE_ERRORS,
} from "@/components/customers/forms/action-result";
import { CustomerHasFinancialRecordsError } from "@/lib/customers/delete-customer";

const CUSTOMER_ID = "customer_1";
const PROPERTY_ID = "property_1";
const PLAN_ID = "plan_1";
const TIER_ID = "tier_1";
const CUSTOMER_PATH = `/admin/customers/${CUSTOMER_ID}`;
const CURRENT_ADDRESS = "123 Main St";
const GEOCODE_RESET = { lat: null, lng: null, geocodedAt: null };
const ONE_JOB = 1;
const NO_ROWS = 0;

function formOf(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

async function redirectOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RedirectSentinel) {
      return error.url;
    }
    throw error;
  }
  return null;
}

const validPropertyFields = {
  customerId: CUSTOMER_ID,
  address: " 123 Main St ",
  accessLocationNotes: "Gate code 1234",
  poolVolumeGallons: "15000",
  hasSpa: "yes",
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.property.findUnique.mockResolvedValue({ customerId: CUSTOMER_ID, address: CURRENT_ADDRESS });
  dbMock.serviceTier.count.mockResolvedValue(ONE_JOB);
  dbMock.serviceTier.findFirst.mockResolvedValue({ id: TIER_ID, checklist: [] });
  dbMock.serviceTier.findUnique.mockResolvedValue({ id: TIER_ID, checklist: [] });
});

describe("createProperty", () => {
  it("devuelve errores de campo traducibles cuando faltan dirección y notas de acceso", async () => {
    // Act
    const result = await createProperty(null, formOf({ customerId: CUSTOMER_ID }));

    // Assert
    expect(result).toEqual({
      ok: false,
      error: CUSTOMER_DETAIL_ERRORS.invalidInput,
      fieldErrors: {
        address: CUSTOMER_DETAIL_ERRORS.propertyAddressRequired,
        accessLocationNotes: CUSTOMER_DETAIL_ERRORS.accessNotesRequired,
      },
    });
    expect(dbMock.property.create).not.toHaveBeenCalled();
  });

  it("rechaza un volumen que no sea entero señalando el campo", async () => {
    // Act
    const result = await createProperty(
      null,
      formOf({ ...validPropertyFields, poolVolumeGallons: "12.5" })
    );

    // Assert
    expect(result).toEqual({
      ok: false,
      error: CUSTOMER_DETAIL_ERRORS.invalidInput,
      fieldErrors: { poolVolumeGallons: CUSTOMER_DETAIL_ERRORS.poolVolumeInvalid },
    });
  });

  it("rechaza datos de pago inválidos cuando el resto del formulario es correcto", async () => {
    // Act
    const result = await createProperty(
      null,
      formOf({ ...validPropertyFields, paymentDay: "40" })
    );

    // Assert
    expect(result).toEqual({
      ok: false,
      error: CUSTOMER_DETAIL_ERRORS.invalidInput,
      fieldErrors: { servicePaymentInfo: CUSTOMER_DETAIL_ERRORS.paymentInfoInvalid },
    });
    expect(dbMock.property.create).not.toHaveBeenCalled();
  });

  it("crea la propiedad normalizada y redirige con feedback en el caso válido", async () => {
    // Act
    const url = await redirectOf(createProperty(null, formOf(validPropertyFields)));

    // Assert
    expect(url).toBe(`${CUSTOMER_PATH}?feedback=property-created`);
    expect(dbMock.property.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: CUSTOMER_ID,
        address: "123 Main St",
        poolVolumeGallons: 15000,
        hasSpa: true,
        accessInfo: "Gate code 1234",
        servicePrice: null,
        paymentType: null,
      }),
    });
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith(CUSTOMER_PATH);
  });
});

describe("updateCustomer", () => {
  it("señala teléfonos inválidos y dirección incompleta sin tocar la BD", async () => {
    // Act
    const result = await updateCustomer(
      null,
      formOf({
        customerId: CUSTOMER_ID,
        nombre: "Ana",
        telefono: "123",
        telefonoSecundario: "abc",
        ciudad: "Miami",
      })
    );

    // Assert
    expect(result).toEqual({
      ok: false,
      error: CUSTOMER_DETAIL_ERRORS.invalidInput,
      fieldErrors: {
        telefono: CUSTOMER_DETAIL_ERRORS.phoneInvalid,
        telefonoSecundario: CUSTOMER_DETAIL_ERRORS.secondaryPhoneInvalid,
        direccionLinea1: CUSTOMER_DETAIL_ERRORS.addressIncomplete,
      },
    });
    expect(dbMock.customer.findUnique).not.toHaveBeenCalled();
  });

  it("devuelve emailInUse cuando otro usuario ya tiene ese email", async () => {
    // Arrange
    dbMock.customer.findUnique.mockResolvedValue({
      userId: "user_1",
      email: "ana@example.com",
      estadoCuenta: "ACTIVE",
      user: { email: "ana@example.com" },
    });
    dbMock.user.findFirst.mockResolvedValue({ id: "user_2" });

    // Act
    const result = await updateCustomer(
      null,
      formOf({ customerId: CUSTOMER_ID, nombre: "Ana", email: "Dup@Example.com" })
    );

    // Assert
    expect(result).toEqual({
      ok: false,
      error: CUSTOMER_DETAIL_ERRORS.emailInUse,
      fieldErrors: { email: CUSTOMER_DETAIL_ERRORS.emailInUse },
    });
    expect(dbMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: "user_1" },
        email: { equals: "dup@example.com", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(dbMock.customer.update).not.toHaveBeenCalled();
  });

  it("devuelve customerNotFound cuando el cliente no existe", async () => {
    // Arrange
    dbMock.customer.findUnique.mockResolvedValue(null);

    // Act
    const result = await updateCustomer(null, formOf({ customerId: CUSTOMER_ID, nombre: "Ana" }));

    // Assert
    expect(result).toEqual({ ok: false, error: CUSTOMER_DETAIL_ERRORS.customerNotFound });
  });
});

describe("inviteCustomer", () => {
  it("devuelve inviteFailed cuando el envío falla y aun así revalida la ficha", async () => {
    // Arrange
    libMocks.sendCustomerInvite.mockResolvedValue({ ok: false, error: "Cliente sin email" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    const result = await inviteCustomer(null, formOf({ customerId: CUSTOMER_ID }));

    // Assert
    expect(result).toEqual({ ok: false, error: CUSTOMER_DETAIL_ERRORS.inviteFailed });
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith(CUSTOMER_PATH);
    consoleError.mockRestore();
  });

  it("devuelve ok cuando la invitación se envía", async () => {
    // Arrange
    libMocks.sendCustomerInvite.mockResolvedValue({ ok: true });

    // Act
    const result = await inviteCustomer(null, formOf({ customerId: CUSTOMER_ID }));

    // Assert
    expect(result).toEqual({ ok: true });
  });
});

describe("deleteCustomer", () => {
  it("exige la palabra de confirmación como error de formulario", async () => {
    // Act
    const result = await deleteCustomer(
      null,
      formOf({ customerId: CUSTOMER_ID, confirmDelete: "yes", typedConfirmation: "nope" })
    );

    // Assert
    expect(result).toEqual({ ok: false, error: CUSTOMER_DETAIL_ERRORS.confirmationMismatch });
    expect(libMocks.deleteCustomerWithRelations).not.toHaveBeenCalled();
  });

  it("borra con la cascada de lib, audita y redirige al listado", async () => {
    // Arrange
    libMocks.deleteCustomerWithRelations.mockResolvedValue({
      customer: { id: CUSTOMER_ID, userId: "user_1", email: "ana@example.com", nombre: "Ana", apellidos: "Perez" },
      removedJobs: ONE_JOB,
      removedPlans: NO_ROWS,
      deletedUserId: "user_1",
    });

    // Act
    const url = await redirectOf(
      deleteCustomer(
        null,
        formOf({ customerId: CUSTOMER_ID, confirmDelete: "yes", typedConfirmation: " ELIMINAR " })
      )
    );

    // Assert
    expect(url).toBe("/admin/customers?feedback=customer-deleted");
    expect(libMocks.deleteCustomerWithRelations).toHaveBeenCalledWith(dbMock, CUSTOMER_ID);
    expect(libMocks.logAuditEvent).toHaveBeenCalledWith({
      userId: "admin_1",
      action: "CUSTOMER_DELETED",
      entity: "Customer",
      entityId: CUSTOMER_ID,
      metadata: {
        email: "ana@example.com",
        linkedUserId: "user_1",
        fullName: "Ana Perez",
        removedJobs: ONE_JOB,
      },
    });
  });
});

describe("deleteProperty", () => {
  it("devuelve propertyHasJobs cuando la propiedad tiene trabajos", async () => {
    // Arrange
    dbMock.job.count.mockResolvedValue(ONE_JOB);

    // Act
    const result = await deleteProperty(
      null,
      formOf({ propertyId: PROPERTY_ID, customerId: CUSTOMER_ID, confirmDelete: "yes" })
    );

    // Assert
    expect(result).toEqual({ ok: false, error: CUSTOMER_DETAIL_ERRORS.propertyHasJobs });
    expect(dbMock.property.delete).not.toHaveBeenCalled();
  });

  it("el adaptador de formulario redirige a la ficha con el error en la URL", async () => {
    // Arrange
    dbMock.job.count.mockResolvedValue(ONE_JOB);

    // Act
    const url = await redirectOf(
      deletePropertyFormAction(
        formOf({ propertyId: PROPERTY_ID, customerId: CUSTOMER_ID, confirmDelete: "yes" })
      )
    );

    // Assert
    expect(url).toBe(`${CUSTOMER_PATH}?feedback=action-error&error=propertyHasJobs`);
  });

  it("rechaza propiedades de otro cliente", async () => {
    // Arrange
    dbMock.property.findUnique.mockResolvedValue({ customerId: "other_customer" });

    // Act
    const result = await deleteProperty(
      null,
      formOf({ propertyId: PROPERTY_ID, customerId: CUSTOMER_ID, confirmDelete: "yes" })
    );

    // Assert
    expect(result).toEqual({ ok: false, error: CUSTOMER_DETAIL_ERRORS.propertyNotFound });
  });
});

describe("updateProperty", () => {
  const updateFields = {
    propertyId: PROPERTY_ID,
    customerId: CUSTOMER_ID,
    address: CURRENT_ADDRESS,
  };

  it("no toca lat/lng/geocodedAt cuando la dirección normalizada no cambia", async () => {
    // Act
    const url = await redirectOf(updateProperty(null, formOf({ ...updateFields, address: " 123 Main St " })));

    // Assert
    expect(url).toBe(`${CUSTOMER_PATH}?feedback=property-saved`);
    const data = dbMock.property.update.mock.calls[0][0].data;
    expect(data.address).toBe(CURRENT_ADDRESS);
    expect(data).not.toHaveProperty("lat");
    expect(data).not.toHaveProperty("lng");
    expect(data).not.toHaveProperty("geocodedAt");
  });

  it("resetea lat/lng/geocodedAt cuando la dirección normalizada cambia", async () => {
    // Act
    await redirectOf(updateProperty(null, formOf({ ...updateFields, address: "456 Oak Ave" })));

    // Assert
    expect(dbMock.property.update).toHaveBeenCalledWith({
      where: { id: PROPERTY_ID },
      data: expect.objectContaining({ address: "456 Oak Ave", ...GEOCODE_RESET }),
    });
  });

  it("devuelve propertyNotFound si la propiedad es de otro cliente", async () => {
    // Arrange
    dbMock.property.findUnique.mockResolvedValue({ customerId: "other", address: CURRENT_ADDRESS });

    // Act
    const result = await updateProperty(null, formOf(updateFields));

    // Assert
    expect(result).toEqual({ ok: false, error: CUSTOMER_DETAIL_ERRORS.propertyNotFound });
    expect(dbMock.property.update).not.toHaveBeenCalled();
  });
});

describe("createJob", () => {
  it("señala una fecha u hora inválidas antes de crear nada", async () => {
    // Act
    const result = await createJob(
      null,
      formOf({
        customerId: CUSTOMER_ID,
        propertyId: PROPERTY_ID,
        scheduledDate: "2026-06-15",
        scheduledTime: "25:00",
      })
    );

    // Assert
    expect(result).toEqual({
      ok: false,
      error: CUSTOMER_DETAIL_ERRORS.invalidInput,
      fieldErrors: { scheduledDate: CUSTOMER_DETAIL_ERRORS.dateInvalid },
    });
    expect(dbMock.job.create).not.toHaveBeenCalled();
  });
});

describe("toggleServicePlan", () => {
  it("devuelve planNotFound si el plan no pertenece al cliente", async () => {
    // Arrange
    dbMock.servicePlan.findUnique.mockResolvedValue({ id: PLAN_ID, customerId: "other" });

    // Act
    const result = await toggleServicePlan(
      null,
      formOf({ planId: PLAN_ID, customerId: CUSTOMER_ID, isActive: "true" })
    );

    // Assert
    expect(result).toEqual({ ok: false, error: CUSTOMER_DETAIL_ERRORS.planNotFound });
    expect(dbMock.servicePlan.update).not.toHaveBeenCalled();
  });

  it("al pausar borra las visitas pendientes y devuelve ok sin redirigir", async () => {
    // Arrange
    dbMock.servicePlan.findUnique.mockResolvedValue({ id: PLAN_ID, customerId: CUSTOMER_ID });
    libMocks.deleteUpcomingPlanJobs.mockResolvedValue(ONE_JOB);

    // Act
    const result = await toggleServicePlan(
      null,
      formOf({ planId: PLAN_ID, customerId: CUSTOMER_ID, isActive: "false" })
    );

    // Assert
    expect(result).toEqual({ ok: true });
    expect(dbMock.servicePlan.update).toHaveBeenCalledWith({
      where: { id: PLAN_ID },
      data: { isActive: false },
    });
    expect(libMocks.deleteUpcomingPlanJobs).toHaveBeenCalledWith(dbMock, PLAN_ID, expect.any(Date));
    expect(libMocks.materializeServicePlanJob).not.toHaveBeenCalled();
  });
});

describe("updateProperty (equipamiento y estado de la piscina)", () => {
  it("guarda marcas, modelos y el semáforo de estado", async () => {
    // Act
    await redirectOf(
      updateProperty(
        null,
        formOf({
          propertyId: PROPERTY_ID,
          customerId: CUSTOMER_ID,
          address: CURRENT_ADDRESS,
          filterBrand: " Hayward ",
          filterModel: "C900",
          pumpBrand: "Pentair",
          pumpHorsepower: "1.5",
          poolConditionNotes: " Bomba ruidosa ",
          condition_pump: "bad",
          condition_filter: "GOOD",
          condition_heater: "unknown-value",
        })
      )
    );

    // Assert
    const data = dbMock.property.update.mock.calls[0][0].data;
    expect(data.filterBrand).toBe("Hayward");
    expect(data.pumpHorsepower).toBe("1.5");
    expect(data.poolConditionNotes).toBe("Bomba ruidosa");
    expect(data.poolCondition).toContainEqual({ key: "pump", status: "BAD" });
    expect(data.poolCondition).toContainEqual({ key: "filter", status: "GOOD" });
    expect(data.poolCondition).toContainEqual({ key: "heater", status: null });
  });

  it("deja a null el equipamiento que llega vacío", async () => {
    // Act
    await redirectOf(
      updateProperty(
        null,
        formOf({
          propertyId: PROPERTY_ID,
          customerId: CUSTOMER_ID,
          address: CURRENT_ADDRESS,
        })
      )
    );

    // Assert
    const data = dbMock.property.update.mock.calls[0][0].data;
    expect(data.filterBrand).toBeNull();
    expect(data.pumpBrand).toBeNull();
    expect(data.poolConditionNotes).toBeNull();
  });
});

describe("deleteCustomer (registros financieros)", () => {
  it("bloquea el borrado cuando el cliente tiene contratos, pagos o membresías", async () => {
    // Arrange
    libMocks.deleteCustomerWithRelations.mockRejectedValue(
      new CustomerHasFinancialRecordsError({
        contracts: 1,
        payments: 0,
        memberships: 2,
      })
    );

    // Act
    const result = await deleteCustomer(
      null,
      formOf({
        customerId: CUSTOMER_ID,
        confirmDelete: "yes",
        typedConfirmation: "eliminar",
      })
    );

    // Assert
    expect(result).toEqual({
      ok: false,
      error: CUSTOMER_DETAIL_ERRORS.hasFinancialRecords,
    });
    expect(navigationMock.redirect).not.toHaveBeenCalled();
  });

  it("propaga cualquier otro fallo del borrado", async () => {
    // Arrange
    libMocks.deleteCustomerWithRelations.mockRejectedValue(new Error("boom"));

    // Act & Assert
    await expect(
      deleteCustomer(
        null,
        formOf({
          customerId: CUSTOMER_ID,
          confirmDelete: "yes",
          typedConfirmation: "eliminar",
        })
      )
    ).rejects.toThrow("boom");
  });
});

describe("updateCustomerFinancials", () => {
  const financialsFields = {
    customerId: CUSTOMER_ID,
    contractedServiceTierId: TIER_ID,
    primaryPropertyId: PROPERTY_ID,
    paymentMethod: "zelle",
    paymentDay: "5",
    servicePrice: "120.5",
    paymentType: "WORKED",
  };

  it("guarda plan y método de pago en el cliente y el cobro en la propiedad principal", async () => {
    // Act
    const url = await redirectOf(
      updateCustomerFinancials(null, formOf(financialsFields))
    );

    // Assert
    expect(url).toBe(`${CUSTOMER_PATH}?feedback=customer-financials-saved`);
    expect(dbMock.customer.update).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID },
      data: { contractedServiceTierId: TIER_ID, paymentMethod: "ZELLE" },
    });
    expect(dbMock.property.update).toHaveBeenCalledWith({
      where: { id: PROPERTY_ID },
      data: expect.objectContaining({ paymentDay: 5, servicePrice: 120.5 }),
    });
  });

  it("rechaza un método de pago desconocido sin tocar la base de datos", async () => {
    // Act
    const result = await updateCustomerFinancials(
      null,
      formOf({ ...financialsFields, paymentMethod: "bitcoin" })
    );

    // Assert
    expect(result).toMatchObject({ ok: false });
    expect(dbMock.customer.update).not.toHaveBeenCalled();
  });

  it("devuelve propertyNotFound si la propiedad principal es de otro cliente", async () => {
    // Arrange
    dbMock.property.findUnique.mockResolvedValue({
      customerId: "other",
      address: CURRENT_ADDRESS,
    });

    // Act
    const result = await updateCustomerFinancials(null, formOf(financialsFields));

    // Assert
    expect(result).toEqual({
      ok: false,
      error: CUSTOMER_DETAIL_ERRORS.propertyNotFound,
    });
    expect(dbMock.customer.update).not.toHaveBeenCalled();
  });
});

describe("updateContractedPlanAction", () => {
  it("rechaza un plan que no existe", async () => {
    // Arrange
    dbMock.serviceTier.findUnique.mockResolvedValue(null);

    // Act
    const result = await updateContractedPlanAction(
      formOf({ customerId: CUSTOMER_ID, contractedServiceTierId: "missing" })
    );

    // Assert
    expect(result).toEqual({ error: CUSTOMER_DETAIL_INLINE_ERRORS.planRequired });
    expect(dbMock.customer.update).not.toHaveBeenCalled();
  });

  it("guarda el plan contratado cuando existe", async () => {
    // Act
    const result = await updateContractedPlanAction(
      formOf({ customerId: CUSTOMER_ID, contractedServiceTierId: TIER_ID })
    );

    // Assert
    expect(result).toBeUndefined();
    expect(dbMock.customer.update).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID },
      data: { contractedServiceTierId: TIER_ID },
    });
  });
});

describe("sendServiceStartAction", () => {
  const sendFields = { customerId: CUSTOMER_ID, propertyId: PROPERTY_ID };

  it("exige un plan contratado antes de enviar nada", async () => {
    // Arrange
    dbMock.customer.findUnique.mockResolvedValue({ contractedServiceTierId: null });

    // Act
    const result = await sendServiceStartAction(formOf(sendFields));

    // Assert
    expect(result).toEqual({ error: CUSTOMER_DETAIL_INLINE_ERRORS.planRequired });
    expect(libMocks.sendMembershipStartEmail).not.toHaveBeenCalled();
  });

  it("envía el alta de membresía cuando el cliente aún no paga por autopago", async () => {
    // Arrange
    dbMock.customer.findUnique.mockResolvedValue({ contractedServiceTierId: TIER_ID });
    dbMock.membership.findFirst.mockResolvedValue(null);

    // Act
    const result = await sendServiceStartAction(formOf(sendFields));

    // Assert
    expect(result).toBeUndefined();
    expect(libMocks.sendMembershipStartEmail).toHaveBeenCalledWith(
      CUSTOMER_ID,
      PROPERTY_ID
    );
    expect(libMocks.sendContractReadyEmail).not.toHaveBeenCalled();
  });

  it("marca el contrato como enviado y avisa al cliente en el portal", async () => {
    // Arrange
    dbMock.customer.findUnique.mockResolvedValue({ contractedServiceTierId: TIER_ID });
    dbMock.membership.findFirst.mockResolvedValue({ id: "membership_1" });
    dbMock.serviceContract.findUnique.mockResolvedValue({ customerId: CUSTOMER_ID });

    // Act
    const result = await sendServiceStartAction(
      formOf({ ...sendFields, contractId: "contract_1" })
    );

    // Assert
    expect(result).toBeUndefined();
    expect(dbMock.serviceContract.update).toHaveBeenCalledWith({
      where: { id: "contract_1" },
      data: expect.objectContaining({ status: "SENT" }),
    });
    expect(libMocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "CONTRACT_READY_TO_SIGN" })
    );
    expect(libMocks.sendContractReadyEmail).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  it("no envía un contrato de otro cliente", async () => {
    // Arrange
    dbMock.customer.findUnique.mockResolvedValue({ contractedServiceTierId: TIER_ID });
    dbMock.membership.findFirst.mockResolvedValue(null);
    dbMock.serviceContract.findUnique.mockResolvedValue({ customerId: "other" });

    // Act
    const result = await sendServiceStartAction(
      formOf({ ...sendFields, contractId: "contract_1" })
    );

    // Assert
    expect(result).toEqual({ error: CUSTOMER_DETAIL_INLINE_ERRORS.sendFailed });
    expect(dbMock.serviceContract.update).not.toHaveBeenCalled();
  });
});

describe("applyMembershipFeeAction", () => {
  it("no aplica la comisión a una membresía de otro cliente", async () => {
    // Arrange
    dbMock.membership.findUnique.mockResolvedValue({ customerId: "other" });

    // Act
    const result = await applyMembershipFeeAction(
      formOf({ membershipId: "membership_1", customerId: CUSTOMER_ID })
    );

    // Assert
    expect(result).toEqual({
      error: CUSTOMER_DETAIL_INLINE_ERRORS.membershipFailed,
    });
    expect(libMocks.applyFeeToMembership).not.toHaveBeenCalled();
  });

  it("convierte un fallo de Stripe en un mensaje para el admin", async () => {
    // Arrange
    dbMock.membership.findUnique.mockResolvedValue({ customerId: CUSTOMER_ID });
    libMocks.applyFeeToMembership.mockRejectedValue(new Error("stripe down"));

    // Act
    const result = await applyMembershipFeeAction(
      formOf({ membershipId: "membership_1", customerId: CUSTOMER_ID })
    );

    // Assert
    expect(result).toEqual({
      error: CUSTOMER_DETAIL_INLINE_ERRORS.membershipFeeFailed,
    });
  });
});

describe("generateServiceContract", () => {
  it("refresca el borrador del periodo en curso en vez de duplicarlo", async () => {
    // Arrange
    const periodMonth = new Date("2026-09-01T00:00:00.000Z");
    libMocks.loadCustomerForContract.mockResolvedValue({
      id: CUSTOMER_ID,
      idiomaPreferencia: "ES",
    });
    dbMock.serviceContract.findFirst.mockResolvedValue({
      id: "contract_1",
      status: "DRAFT",
      periodMonth,
    });
    dbMock.serviceContract.update.mockResolvedValue({ id: "contract_1" });

    // Act
    const url = await redirectOf(
      generateServiceContract(formOf({ customerId: CUSTOMER_ID }))
    );

    // Assert
    expect(url).toBe(`${CUSTOMER_PATH}?feedback=contract-generated`);
    expect(dbMock.serviceContract.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "contract_1" } })
    );
    expect(dbMock.serviceContract.create).not.toHaveBeenCalled();
  });

  it("abre un contrato nuevo cuando el último ya se envió", async () => {
    // Arrange
    libMocks.loadCustomerForContract.mockResolvedValue({
      id: CUSTOMER_ID,
      idiomaPreferencia: "ES",
    });
    dbMock.serviceContract.findFirst.mockResolvedValue({
      id: "contract_1",
      status: "SENT",
      periodMonth: new Date("2026-09-01T00:00:00.000Z"),
    });
    dbMock.serviceContract.create.mockResolvedValue({ id: "contract_2" });

    // Act
    await redirectOf(generateServiceContract(formOf({ customerId: CUSTOMER_ID })));

    // Assert
    expect(dbMock.serviceContract.create).toHaveBeenCalled();
    expect(dbMock.serviceContract.update).not.toHaveBeenCalled();
  });

  it("lleva el mensaje del fallo a la URL cuando el PDF no se genera", async () => {
    // Arrange
    libMocks.loadCustomerForContract.mockResolvedValue({
      id: CUSTOMER_ID,
      idiomaPreferencia: "ES",
    });
    dbMock.serviceContract.findFirst.mockResolvedValue(null);
    dbMock.serviceContract.create.mockResolvedValue({ id: "contract_2" });
    libMocks.renderAndStoreContractPdf.mockRejectedValue(new Error("chromium missing"));

    // Act
    const url = await redirectOf(
      generateServiceContract(formOf({ customerId: CUSTOMER_ID }))
    );

    // Assert
    expect(url).toContain("feedback=contract-generate-failed");
    expect(url).toContain("contractError=chromium+missing");
  });
});
