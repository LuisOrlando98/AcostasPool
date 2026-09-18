import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_TRANSFER_FORMAT,
  customerTransferPayloadSchema,
  getCustomerTransferDisplayName,
  sanitizeImportedTransferCustomer,
  type CustomerTransferPayload,
} from "@/lib/customers/transfer";
import { normalizePropertyAddress } from "@/lib/routing/address";
import { parseBusinessDateInput } from "@/lib/timezone";

vi.mock("@/lib/routing/address", () => ({
  normalizePropertyAddress: vi.fn(async (address: string) =>
    address.trim().replace(/\s+/g, " ")
  ),
}));

type TransferCustomerInput = CustomerTransferPayload["customers"][number];
type TransferPropertyInput = NonNullable<
  TransferCustomerInput["properties"]
>[number];

const MINIMAL_CUSTOMER: TransferCustomerInput = { nombre: "Ana" };

function customerWithProperty(
  property: Partial<TransferPropertyInput>
): TransferCustomerInput {
  return {
    ...MINIMAL_CUSTOMER,
    properties: [{ address: "1 Main St", ...property }],
  };
}

describe("CUSTOMER_TRANSFER_FORMAT", () => {
  it("is the versioned format identifier", () => {
    expect(CUSTOMER_TRANSFER_FORMAT).toBe("acostaspool.customers.v1");
  });
});

describe("customerTransferPayloadSchema", () => {
  it("accepts a minimal payload with an empty customers array", () => {
    const result = customerTransferPayloadSchema.safeParse({
      format: CUSTOMER_TRANSFER_FORMAT,
      customers: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown format literal", () => {
    const result = customerTransferPayloadSchema.safeParse({
      format: "acostaspool.customers.v2",
      customers: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload without customers", () => {
    const result = customerTransferPayloadSchema.safeParse({
      format: CUSTOMER_TRANSFER_FORMAT,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative totals", () => {
    const result = customerTransferPayloadSchema.safeParse({
      format: CUSTOMER_TRANSFER_FORMAT,
      totals: { customers: -1 },
      customers: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts customers whose nombre is absent (z.unknown allows undefined)", () => {
    const result = customerTransferPayloadSchema.safeParse({
      format: CUSTOMER_TRANSFER_FORMAT,
      customers: [{}],
    });
    expect(result.success).toBe(true);
  });

  it("accepts non-string values for loosely typed fields", () => {
    const result = customerTransferPayloadSchema.safeParse({
      format: CUSTOMER_TRANSFER_FORMAT,
      customers: [
        {
          nombre: 42,
          allowWeekendBooking: "yes",
          linkedUser: null,
          properties: [{ address: 7, hasSpa: 1 }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("getCustomerTransferDisplayName", () => {
  it("joins nombre and apellidos", () => {
    expect(
      getCustomerTransferDisplayName({ nombre: " Ana ", apellidos: "Pérez" })
    ).toBe("Ana Pérez");
  });

  it("uses nombre alone when apellidos is missing", () => {
    expect(getCustomerTransferDisplayName({ nombre: "Ana" })).toBe("Ana");
  });

  it("falls back to the email when no name is present", () => {
    expect(
      getCustomerTransferDisplayName({ nombre: "  ", email: "ana@x.com" })
    ).toBe("ana@x.com");
  });

  it("falls back to sourceCustomerId when name and email are missing", () => {
    expect(getCustomerTransferDisplayName({ sourceCustomerId: 15 })).toBe(
      "15"
    );
  });

  it("falls back to 'Cliente' when nothing usable is provided", () => {
    expect(
      getCustomerTransferDisplayName({ nombre: null, email: {} })
    ).toBe("Cliente");
  });
});

describe("sanitizeImportedTransferCustomer", () => {
  beforeEach(() => {
    vi.mocked(normalizePropertyAddress).mockClear();
  });

  it("throws when nombre is missing or blank", async () => {
    await expect(
      sanitizeImportedTransferCustomer({ nombre: "   " })
    ).rejects.toThrow("nombre es obligatorio.");
  });

  it("applies defaults for every optional field", async () => {
    const result = await sanitizeImportedTransferCustomer(MINIMAL_CUSTOMER);

    expect(result).toEqual({
      sourceCustomerId: null,
      nombre: "Ana",
      apellidos: "",
      email: "",
      telefono: "",
      telefonoSecundario: null,
      idiomaPreferencia: "EN",
      estadoCuenta: "ACTIVE",
      tipoCliente: "RESIDENTIAL",
      allowWeekendBooking: false,
      direccionLinea1: null,
      direccionLinea2: null,
      ciudad: null,
      estadoProvincia: null,
      codigoPostal: null,
      notas: null,
      properties: [],
    });
  });

  it("normalizes the email (trim + lowercase)", async () => {
    const result = await sanitizeImportedTransferCustomer({
      ...MINIMAL_CUSTOMER,
      email: "  Ana@Example.COM ",
    });
    expect(result.email).toBe("ana@example.com");
  });

  it("normalizes phone numbers to the US display format", async () => {
    const result = await sanitizeImportedTransferCustomer({
      ...MINIMAL_CUSTOMER,
      telefono: "(305) 555-0123",
      telefonoSecundario: "13055550124",
    });
    expect(result.telefono).toBe("+1 (305)-555-0123");
    expect(result.telefonoSecundario).toBe("+1 (305)-555-0124");
  });

  it("throws with the field label when a phone is invalid", async () => {
    await expect(
      sanitizeImportedTransferCustomer({ ...MINIMAL_CUSTOMER, telefono: "123" })
    ).rejects.toThrow("telefono no tiene un formato valido.");
    await expect(
      sanitizeImportedTransferCustomer({
        ...MINIMAL_CUSTOMER,
        telefonoSecundario: "123",
      })
    ).rejects.toThrow("telefonoSecundario no tiene un formato valido.");
  });

  it("converts numeric identifiers and names to strings", async () => {
    const result = await sanitizeImportedTransferCustomer({
      sourceCustomerId: 42,
      nombre: 7,
      apellidos: 3.5,
    });
    expect(result.sourceCustomerId).toBe("42");
    expect(result.nombre).toBe("7");
    expect(result.apellidos).toBe("3.5");
  });

  it("maps idiomaPreferencia case-insensitively and defaults to EN", async () => {
    const es = await sanitizeImportedTransferCustomer({
      ...MINIMAL_CUSTOMER,
      idiomaPreferencia: " es ",
    });
    const fr = await sanitizeImportedTransferCustomer({
      ...MINIMAL_CUSTOMER,
      idiomaPreferencia: "fr",
    });
    expect(es.idiomaPreferencia).toBe("ES");
    expect(fr.idiomaPreferencia).toBe("EN");
  });

  it("maps estadoCuenta and tipoCliente, defaulting unknown values", async () => {
    const result = await sanitizeImportedTransferCustomer({
      ...MINIMAL_CUSTOMER,
      estadoCuenta: "inactive",
      tipoCliente: "Commercial",
    });
    const fallback = await sanitizeImportedTransferCustomer({
      ...MINIMAL_CUSTOMER,
      estadoCuenta: "paused",
      tipoCliente: "other",
    });
    expect(result.estadoCuenta).toBe("INACTIVE");
    expect(result.tipoCliente).toBe("COMMERCIAL");
    expect(fallback.estadoCuenta).toBe("ACTIVE");
    expect(fallback.tipoCliente).toBe("RESIDENTIAL");
  });

  it.each([
    ["yes", true],
    ["Si", true],
    ["TRUE", true],
    ["1", true],
    [1, true],
    [true, true],
    ["no", false],
    ["0", false],
    [0, false],
    ["maybe", false],
    [null, false],
  ])("parses allowWeekendBooking %p as %p", async (raw, expected) => {
    const result = await sanitizeImportedTransferCustomer({
      ...MINIMAL_CUSTOMER,
      allowWeekendBooking: raw,
    });
    expect(result.allowWeekendBooking).toBe(expected);
  });

  it("throws when a property has no address", async () => {
    await expect(
      sanitizeImportedTransferCustomer({
        ...MINIMAL_CUSTOMER,
        properties: [{ address: "   " }],
      })
    ).rejects.toThrow("Cada propiedad necesita address.");
  });

  it("normalizes the property address through normalizePropertyAddress", async () => {
    const result = await sanitizeImportedTransferCustomer(
      customerWithProperty({ address: "  1   Main   St " })
    );
    expect(normalizePropertyAddress).toHaveBeenCalledWith("1   Main   St");
    expect(result.properties[0].address).toBe("1 Main St");
  });

  it("applies property defaults when only the address is given", async () => {
    const result = await sanitizeImportedTransferCustomer(
      customerWithProperty({})
    );
    expect(result.properties[0]).toEqual({
      sourcePropertyId: null,
      name: null,
      address: "1 Main St",
      poolType: null,
      poolVolumeGallons: null,
      sanitizerType: null,
      filterType: null,
      hasSpa: false,
      accessLocationNotes: null,
      serviceStartDate: null,
      paymentDay: null,
      servicePrice: null,
      paymentType: null,
      paymentNotes: null,
    });
  });

  it("parses integer fields from numbers and numeric strings", async () => {
    const result = await sanitizeImportedTransferCustomer(
      customerWithProperty({ poolVolumeGallons: "15000", paymentDay: 15 })
    );
    expect(result.properties[0].poolVolumeGallons).toBe(15000);
    expect(result.properties[0].paymentDay).toBe(15);
  });

  it("rejects non-integer poolVolumeGallons", async () => {
    await expect(
      sanitizeImportedTransferCustomer(
        customerWithProperty({ poolVolumeGallons: 12.5 })
      )
    ).rejects.toThrow("poolVolumeGallons debe ser un numero entero.");
    await expect(
      sanitizeImportedTransferCustomer(
        customerWithProperty({ poolVolumeGallons: "abc" })
      )
    ).rejects.toThrow("poolVolumeGallons debe ser un numero entero.");
  });

  it("rejects negative poolVolumeGallons", async () => {
    await expect(
      sanitizeImportedTransferCustomer(
        customerWithProperty({ poolVolumeGallons: -1 })
      )
    ).rejects.toThrow("poolVolumeGallons debe ser mayor o igual a 0.");
  });

  it("enforces the 1..31 range on paymentDay", async () => {
    await expect(
      sanitizeImportedTransferCustomer(customerWithProperty({ paymentDay: 0 }))
    ).rejects.toThrow("paymentDay debe ser mayor o igual a 1.");
    await expect(
      sanitizeImportedTransferCustomer(customerWithProperty({ paymentDay: 32 }))
    ).rejects.toThrow("paymentDay debe ser menor o igual a 31.");
  });

  it("rounds servicePrice to two decimals and rejects negatives or NaN", async () => {
    const result = await sanitizeImportedTransferCustomer(
      customerWithProperty({ servicePrice: "12.345" })
    );
    expect(result.properties[0].servicePrice).toBe(12.35);

    await expect(
      sanitizeImportedTransferCustomer(customerWithProperty({ servicePrice: -5 }))
    ).rejects.toThrow("servicePrice no puede ser negativo.");
    await expect(
      sanitizeImportedTransferCustomer(
        customerWithProperty({ servicePrice: "abc" })
      )
    ).rejects.toThrow("servicePrice debe ser un numero valido.");
  });

  it("treats blank numeric strings as null", async () => {
    const result = await sanitizeImportedTransferCustomer(
      customerWithProperty({
        poolVolumeGallons: "  ",
        paymentDay: "",
        servicePrice: "",
      })
    );
    expect(result.properties[0].poolVolumeGallons).toBeNull();
    expect(result.properties[0].paymentDay).toBeNull();
    expect(result.properties[0].servicePrice).toBeNull();
  });

  it("normalizes paymentType aliases and rejects unknown values", async () => {
    const result = await sanitizeImportedTransferCustomer(
      customerWithProperty({ paymentType: "x trabajar" })
    );
    expect(result.properties[0].paymentType).toBe("TO_WORK");

    await expect(
      sanitizeImportedTransferCustomer(
        customerWithProperty({ paymentType: "monthly" })
      )
    ).rejects.toThrow("paymentType no es valido.");
  });

  it("parses serviceStartDate as a business date and rejects other formats", async () => {
    const result = await sanitizeImportedTransferCustomer(
      customerWithProperty({ serviceStartDate: "2024-05-10" })
    );
    expect(result.properties[0].serviceStartDate).toEqual(
      parseBusinessDateInput("2024-05-10")
    );

    await expect(
      sanitizeImportedTransferCustomer(
        customerWithProperty({ serviceStartDate: "10/05/2024" })
      )
    ).rejects.toThrow("serviceStartDate debe usar el formato YYYY-MM-DD.");
  });

  it("parses hasSpa with the boolean rules", async () => {
    const result = await sanitizeImportedTransferCustomer(
      customerWithProperty({ hasSpa: "true" })
    );
    expect(result.properties[0].hasSpa).toBe(true);
  });

  it("keeps property order and trims string fields", async () => {
    const result = await sanitizeImportedTransferCustomer({
      ...MINIMAL_CUSTOMER,
      properties: [
        { address: "A St", name: " Front pool " },
        { address: "B St", name: "Back pool" },
      ],
    });
    expect(result.properties.map((property) => property.name)).toEqual([
      "Front pool",
      "Back pool",
    ]);
  });
});
