import { describe, expect, it } from "vitest";
import {
  CUSTOMER_TRANSFER_FORMAT,
  type CustomerTransferPayload,
} from "@/lib/customers/transfer";
import {
  CUSTOMER_TRANSFER_SHEET_NAME,
  CUSTOMER_TRANSFER_TABLE_COLUMNS,
  buildCustomerTransferPayloadFromTableRows,
  decodeCsvMatrix,
  encodeCustomerTransferCsv,
  flattenCustomerTransferPayload,
  parseCustomerTransferCsv,
  parseCustomerTransferTableMatrix,
} from "@/lib/customers/transfer-table";

const BOM = "\uFEFF";
const HEADER_LINE = CUSTOMER_TRANSFER_TABLE_COLUMNS.join(",");
const EXPECTED_COLUMN_COUNT = 34;

const SAMPLE_PAYLOAD: CustomerTransferPayload = {
  format: CUSTOMER_TRANSFER_FORMAT,
  customers: [
    {
      sourceCustomerId: "c1",
      nombre: "Ana",
      apellidos: "Pérez",
      email: "ana@x.com",
      allowWeekendBooking: true,
      linkedUser: { email: "ana@x.com", isActive: true },
      properties: [
        {
          sourcePropertyId: "p1",
          address: "1 Main St, Miami",
          hasSpa: false,
          poolVolumeGallons: 15000,
          paymentType: "TO_WORK",
        },
        {
          sourcePropertyId: "p2",
          address: '2 "Quoted" Ave',
        },
      ],
    },
    {
      nombre: "Luis",
      properties: [],
    },
  ],
};

function emptyRow(overrides: Record<string, unknown> = {}) {
  const base = Object.fromEntries(
    CUSTOMER_TRANSFER_TABLE_COLUMNS.map((column) => [column, ""])
  );
  return { ...base, ...overrides };
}

describe("constants", () => {
  it("exposes the sheet name and the full column list", () => {
    expect(CUSTOMER_TRANSFER_SHEET_NAME).toBe("customers_transfer");
    expect(CUSTOMER_TRANSFER_TABLE_COLUMNS).toHaveLength(EXPECTED_COLUMN_COUNT);
    expect(CUSTOMER_TRANSFER_TABLE_COLUMNS[0]).toBe("format");
    expect(CUSTOMER_TRANSFER_TABLE_COLUMNS.at(-1)).toBe("paymentNotes");
  });
});

describe("flattenCustomerTransferPayload", () => {
  it("emits one row per property sharing the customer group key", () => {
    const rows = flattenCustomerTransferPayload(SAMPLE_PAYLOAD);

    expect(rows).toHaveLength(3);
    expect(rows[0].customerGroupKey).toBe("c1");
    expect(rows[1].customerGroupKey).toBe("c1");
    expect(rows[0].sourcePropertyId).toBe("p1");
    expect(rows[1].sourcePropertyId).toBe("p2");
    expect(rows[0].format).toBe(CUSTOMER_TRANSFER_FORMAT);
  });

  it("emits a single row with empty property cells for customers without properties", () => {
    const rows = flattenCustomerTransferPayload(SAMPLE_PAYLOAD);
    const luisRow = rows[2];

    expect(luisRow.nombre).toBe("Luis");
    expect(luisRow.customerGroupKey).toBe("customer-0002");
    expect(luisRow.propertyAddress).toBe("");
    expect(luisRow.sourcePropertyId).toBe("");
  });

  it("uses an index-based group key when sourceCustomerId is missing", () => {
    const rows = flattenCustomerTransferPayload({
      format: CUSTOMER_TRANSFER_FORMAT,
      customers: [{ nombre: "A" }, { nombre: "B" }],
    });
    expect(rows.map((row) => row.customerGroupKey)).toEqual([
      "customer-0001",
      "customer-0002",
    ]);
  });

  it("trims the group key but keeps the raw sourceCustomerId cell", () => {
    const rows = flattenCustomerTransferPayload({
      format: CUSTOMER_TRANSFER_FORMAT,
      customers: [{ sourceCustomerId: "  c9  ", nombre: "A" }],
    });
    expect(rows[0].customerGroupKey).toBe("c9");
    expect(rows[0].sourceCustomerId).toBe("  c9  ");
  });

  it("stringifies booleans, numbers and nullish values", () => {
    const rows = flattenCustomerTransferPayload(SAMPLE_PAYLOAD);
    expect(rows[0].allowWeekendBooking).toBe("true");
    expect(rows[0].hasSpa).toBe("false");
    expect(rows[0].poolVolumeGallons).toBe("15000");
    expect(rows[0].telefono).toBe("");
    expect(rows[0].linkedUserEmail).toBe("ana@x.com");
    expect(rows[0].linkedUserIsActive).toBe("true");
  });

  it("produces every column on every row", () => {
    const rows = flattenCustomerTransferPayload(SAMPLE_PAYLOAD);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(
        [...CUSTOMER_TRANSFER_TABLE_COLUMNS].sort()
      );
    }
  });
});

describe("encodeCustomerTransferCsv", () => {
  it("starts with a BOM, the header line, and uses CRLF line endings", () => {
    const csv = encodeCustomerTransferCsv({
      format: CUSTOMER_TRANSFER_FORMAT,
      customers: [],
    });
    expect(csv).toBe(`${BOM}${HEADER_LINE}\r\n`);
  });

  it("quotes cells containing commas, quotes or newlines", () => {
    const csv = encodeCustomerTransferCsv({
      format: CUSTOMER_TRANSFER_FORMAT,
      customers: [
        {
          nombre: "Ana",
          notas: "line1\nline2",
          properties: [{ address: "1 Main St, Miami", name: 'The "Pool"' }],
        },
      ],
    });
    const lines = csv.split("\r\n");
    expect(lines[1]).toContain('"1 Main St, Miami"');
    expect(lines[1]).toContain('"The ""Pool"""');
    expect(csv).toContain('"line1\nline2"');
    expect(lines[1]).toContain(",Ana,");
  });
});

describe("decodeCsvMatrix", () => {
  it("splits simple rows and cells", () => {
    expect(decodeCsvMatrix("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("supports CRLF endings and a missing trailing newline", () => {
    expect(decodeCsvMatrix("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("decodes quoted cells with commas, escaped quotes and newlines", () => {
    expect(
      decodeCsvMatrix('"x, y","he said ""hi""","line1\nline2"\n')
    ).toEqual([["x, y", 'he said "hi"', "line1\nline2"]]);
  });

  it("strips a leading BOM", () => {
    expect(decodeCsvMatrix(`${BOM}a,b\n`)).toEqual([["a", "b"]]);
  });

  it("drops rows whose cells are all blank", () => {
    expect(decodeCsvMatrix("a,b\n\n , \n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps an empty trailing cell after a trailing comma", () => {
    expect(decodeCsvMatrix("a,")).toEqual([["a", ""]]);
  });

  it("returns an empty matrix for empty input", () => {
    expect(decodeCsvMatrix("")).toEqual([]);
  });

  it("treats a lone carriage return as a regular character", () => {
    expect(decodeCsvMatrix("a\rb")).toEqual([["a\rb"]]);
  });
});

describe("parseCustomerTransferCsv", () => {
  it("round-trips a payload through CSV encoding", () => {
    const csv = encodeCustomerTransferCsv(SAMPLE_PAYLOAD);
    const parsed = parseCustomerTransferCsv(csv);

    expect(parsed.format).toBe(CUSTOMER_TRANSFER_FORMAT);
    expect(parsed.totals).toEqual({ customers: 2, properties: 2 });
    expect(parsed.customers).toEqual([
      {
        sourceCustomerId: "c1",
        nombre: "Ana",
        apellidos: "Pérez",
        email: "ana@x.com",
        allowWeekendBooking: "true",
        linkedUser: { email: "ana@x.com", isActive: "true" },
        properties: [
          {
            sourcePropertyId: "p1",
            address: "1 Main St, Miami",
            hasSpa: "false",
            poolVolumeGallons: "15000",
            paymentType: "TO_WORK",
          },
          { sourcePropertyId: "p2", address: '2 "Quoted" Ave' },
        ],
      },
      { nombre: "Luis", properties: [] },
    ]);
  });

  it("throws when the CSV has no rows at all", () => {
    expect(() => parseCustomerTransferCsv("")).toThrow(
      "El archivo CSV no contiene filas para importar."
    );
  });

  it("throws listing the missing mandatory columns", () => {
    expect(() => parseCustomerTransferCsv("nombre,email\nAna,a@x.com")).toThrow(
      /Faltan columnas obligatorias en el archivo: format, customerGroupKey/
    );
  });
});

describe("buildCustomerTransferPayloadFromTableRows", () => {
  it("returns an empty payload with zero totals for no rows", () => {
    expect(buildCustomerTransferPayloadFromTableRows([])).toEqual({
      format: CUSTOMER_TRANSFER_FORMAT,
      totals: { customers: 0, properties: 0 },
      customers: [],
    });
  });

  it("ignores rows whose cells are all blank", () => {
    const payload = buildCustomerTransferPayloadFromTableRows([
      emptyRow(),
      emptyRow({ nombre: "   " }),
    ]);
    expect(payload.customers).toEqual([]);
  });

  it("throws on a row with a different format identifier", () => {
    expect(() =>
      buildCustomerTransferPayloadFromTableRows([
        emptyRow({ format: "other.format", nombre: "Ana" }),
      ])
    ).toThrow("Formato no soportado: other.format.");
  });

  it("accepts rows with an empty format cell", () => {
    const payload = buildCustomerTransferPayloadFromTableRows([
      emptyRow({ nombre: "Ana" }),
    ]);
    expect(payload.customers[0].nombre).toBe("Ana");
  });

  it("groups rows by customerGroupKey and collects their properties", () => {
    const payload = buildCustomerTransferPayloadFromTableRows([
      emptyRow({ customerGroupKey: "g1", nombre: "Ana", propertyAddress: "A St" }),
      emptyRow({ customerGroupKey: "g1", nombre: "Ana", propertyAddress: "B St" }),
      emptyRow({ customerGroupKey: "g2", nombre: "Luis" }),
    ]);

    expect(payload.totals).toEqual({ customers: 2, properties: 2 });
    expect(payload.customers[0].properties?.map((p) => p.address)).toEqual([
      "A St",
      "B St",
    ]);
    expect(payload.customers[1].properties).toEqual([]);
  });

  it("falls back to sourceCustomerId, then email, then a row counter as group key", () => {
    const payload = buildCustomerTransferPayloadFromTableRows([
      emptyRow({ sourceCustomerId: "s1", nombre: "A" }),
      emptyRow({ sourceCustomerId: "s1", nombre: "A", propertyAddress: "X" }),
      emptyRow({ email: "b@x.com", nombre: "B" }),
      emptyRow({ email: "b@x.com", nombre: "B", propertyAddress: "Y" }),
      emptyRow({ nombre: "C" }),
      emptyRow({ nombre: "C" }),
    ]);

    expect(payload.customers.map((customer) => customer.nombre)).toEqual([
      "A",
      "B",
      "C",
      "C",
    ]);
    expect(payload.customers[0].properties).toHaveLength(1);
    expect(payload.customers[1].properties).toHaveLength(1);
  });

  it("fills customer fields left empty by earlier rows of the same group", () => {
    const payload = buildCustomerTransferPayloadFromTableRows([
      emptyRow({ customerGroupKey: "g", nombre: "Ana" }),
      emptyRow({ customerGroupKey: "g", apellidos: "Pérez", email: "a@x.com" }),
    ]);

    expect(payload.customers).toHaveLength(1);
    expect(payload.customers[0]).toMatchObject({
      nombre: "Ana",
      apellidos: "Pérez",
      email: "a@x.com",
    });
  });

  it("only creates a linkedUser when one of its cells is filled", () => {
    const withUser = buildCustomerTransferPayloadFromTableRows([
      emptyRow({ nombre: "A", linkedUserIsActive: "true" }),
    ]);
    const withoutUser = buildCustomerTransferPayloadFromTableRows([
      emptyRow({ nombre: "A" }),
    ]);

    expect(withUser.customers[0].linkedUser).toEqual({
      email: undefined,
      isActive: "true",
    });
    expect(withoutUser.customers[0].linkedUser).toBeUndefined();
  });

  it("stringifies non-string cell values", () => {
    const payload = buildCustomerTransferPayloadFromTableRows([
      emptyRow({ nombre: 123, allowWeekendBooking: true, paymentDay: 5 }),
    ]);

    expect(payload.customers[0].nombre).toBe("123");
    expect(payload.customers[0].allowWeekendBooking).toBe("true");
    expect(payload.customers[0].properties?.[0].paymentDay).toBe("5");
  });

  it("adds a property when any property cell is filled, even without address", () => {
    const payload = buildCustomerTransferPayloadFromTableRows([
      emptyRow({ nombre: "A", poolType: "Gunite" }),
    ]);
    expect(payload.customers[0].properties).toEqual([
      { address: "", poolType: "Gunite" },
    ]);
  });
});

describe("parseCustomerTransferTableMatrix", () => {
  it("trims header names and pads short rows with empty strings", () => {
    const headers = CUSTOMER_TRANSFER_TABLE_COLUMNS.map((column) => ` ${column} `);
    const payload = parseCustomerTransferTableMatrix(headers, [
      ["", "g1", "", "Ana"],
    ]);

    expect(payload.customers).toEqual([{ nombre: "Ana", properties: [] }]);
  });

  it("ignores extra unknown columns", () => {
    const headers = [...CUSTOMER_TRANSFER_TABLE_COLUMNS, "extra"];
    const cells = CUSTOMER_TRANSFER_TABLE_COLUMNS.map(() => "");
    cells[3] = "Ana";
    const payload = parseCustomerTransferTableMatrix(headers, [
      [...cells, "ignored"],
    ]);

    expect(payload.customers[0].nombre).toBe("Ana");
    expect(payload.customers[0]).not.toHaveProperty("extra");
  });

  it("throws when a mandatory header is missing", () => {
    const headers = CUSTOMER_TRANSFER_TABLE_COLUMNS.filter(
      (column) => column !== "paymentNotes"
    );
    expect(() => parseCustomerTransferTableMatrix(headers, [])).toThrow(
      "Faltan columnas obligatorias en el archivo: paymentNotes."
    );
  });
});
