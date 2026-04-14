import {
  CUSTOMER_TRANSFER_FORMAT,
  customerTransferPayloadSchema,
  type CustomerTransferPayload,
} from "@/lib/customers/transfer";

export const CUSTOMER_TRANSFER_SHEET_NAME = "customers_transfer";

export const CUSTOMER_TRANSFER_TABLE_COLUMNS = [
  "format",
  "customerGroupKey",
  "sourceCustomerId",
  "nombre",
  "apellidos",
  "email",
  "telefono",
  "telefonoSecundario",
  "idiomaPreferencia",
  "estadoCuenta",
  "tipoCliente",
  "allowWeekendBooking",
  "direccionLinea1",
  "direccionLinea2",
  "ciudad",
  "estadoProvincia",
  "codigoPostal",
  "notas",
  "linkedUserEmail",
  "linkedUserIsActive",
  "sourcePropertyId",
  "propertyName",
  "propertyAddress",
  "poolType",
  "poolVolumeGallons",
  "sanitizerType",
  "filterType",
  "hasSpa",
  "accessLocationNotes",
  "serviceStartDate",
  "paymentDay",
  "servicePrice",
  "paymentType",
  "paymentNotes",
] as const;

export type CustomerTransferTableColumn =
  (typeof CUSTOMER_TRANSFER_TABLE_COLUMNS)[number];

export type CustomerTransferTableRow = Record<CustomerTransferTableColumn, string>;

function toCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function getTrimmedValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function assertExpectedHeaders(headers: string[]) {
  const missingHeaders = CUSTOMER_TRANSFER_TABLE_COLUMNS.filter(
    (column) => !headers.includes(column)
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Faltan columnas obligatorias en el archivo: ${missingHeaders.join(", ")}.`
    );
  }
}

export function flattenCustomerTransferPayload(
  payload: CustomerTransferPayload
): CustomerTransferTableRow[] {
  return payload.customers.flatMap((customer, index) => {
    const customerGroupKey =
      customer.sourceCustomerId?.toString().trim() ||
      `customer-${String(index + 1).padStart(4, "0")}`;
    const properties = customer.properties?.length
      ? customer.properties
      : [null];

    return properties.map((property) => ({
      format: CUSTOMER_TRANSFER_FORMAT,
      customerGroupKey,
      sourceCustomerId: toCellValue(customer.sourceCustomerId),
      nombre: toCellValue(customer.nombre),
      apellidos: toCellValue(customer.apellidos),
      email: toCellValue(customer.email),
      telefono: toCellValue(customer.telefono),
      telefonoSecundario: toCellValue(customer.telefonoSecundario),
      idiomaPreferencia: toCellValue(customer.idiomaPreferencia),
      estadoCuenta: toCellValue(customer.estadoCuenta),
      tipoCliente: toCellValue(customer.tipoCliente),
      allowWeekendBooking: toCellValue(customer.allowWeekendBooking),
      direccionLinea1: toCellValue(customer.direccionLinea1),
      direccionLinea2: toCellValue(customer.direccionLinea2),
      ciudad: toCellValue(customer.ciudad),
      estadoProvincia: toCellValue(customer.estadoProvincia),
      codigoPostal: toCellValue(customer.codigoPostal),
      notas: toCellValue(customer.notas),
      linkedUserEmail: toCellValue(customer.linkedUser?.email),
      linkedUserIsActive: toCellValue(customer.linkedUser?.isActive),
      sourcePropertyId: toCellValue(property?.sourcePropertyId),
      propertyName: toCellValue(property?.name),
      propertyAddress: toCellValue(property?.address),
      poolType: toCellValue(property?.poolType),
      poolVolumeGallons: toCellValue(property?.poolVolumeGallons),
      sanitizerType: toCellValue(property?.sanitizerType),
      filterType: toCellValue(property?.filterType),
      hasSpa: toCellValue(property?.hasSpa),
      accessLocationNotes: toCellValue(property?.accessLocationNotes),
      serviceStartDate: toCellValue(property?.serviceStartDate),
      paymentDay: toCellValue(property?.paymentDay),
      servicePrice: toCellValue(property?.servicePrice),
      paymentType: toCellValue(property?.paymentType),
      paymentNotes: toCellValue(property?.paymentNotes),
    }));
  });
}

function stringifyCsvCell(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function encodeCustomerTransferCsv(payload: CustomerTransferPayload) {
  const rows = flattenCustomerTransferPayload(payload);
  const headerLine = CUSTOMER_TRANSFER_TABLE_COLUMNS.join(",");
  const bodyLines = rows.map((row) =>
    CUSTOMER_TRANSFER_TABLE_COLUMNS.map((column) =>
      stringifyCsvCell(row[column] ?? "")
    ).join(",")
  );

  return `\uFEFF${[headerLine, ...bodyLines].join("\r\n")}\r\n`;
}

export function decodeCsvMatrix(input: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let index = 0;
  let insideQuotes = false;
  const normalizedInput = input.replace(/^\uFEFF/, "");

  while (index < normalizedInput.length) {
    const currentChar = normalizedInput[index];
    const nextChar = normalizedInput[index + 1];

    if (insideQuotes) {
      if (currentChar === '"' && nextChar === '"') {
        currentCell += '"';
        index += 2;
        continue;
      }
      if (currentChar === '"') {
        insideQuotes = false;
        index += 1;
        continue;
      }
      currentCell += currentChar;
      index += 1;
      continue;
    }

    if (currentChar === '"') {
      insideQuotes = true;
      index += 1;
      continue;
    }

    if (currentChar === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      index += 1;
      continue;
    }

    if (currentChar === "\r" && nextChar === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      index += 2;
      continue;
    }

    if (currentChar === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      index += 1;
      continue;
    }

    currentCell += currentChar;
    index += 1;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}

function groupCustomerRows(rows: CustomerTransferTableRow[]) {
  const grouped = new Map<string, CustomerTransferPayload["customers"][number]>();
  let fallbackIndex = 0;

  for (const row of rows) {
    const format = getTrimmedValue(row.format);
    if (format && format !== CUSTOMER_TRANSFER_FORMAT) {
      throw new Error(`Formato no soportado: ${format}.`);
    }

    const groupKey =
      getTrimmedValue(row.customerGroupKey) ||
      getTrimmedValue(row.sourceCustomerId) ||
      getTrimmedValue(row.email) ||
      `row-${String((fallbackIndex += 1)).padStart(4, "0")}`;

    const existing =
      grouped.get(groupKey) ??
      ({
        sourceCustomerId: getTrimmedValue(row.sourceCustomerId) || undefined,
        nombre: getTrimmedValue(row.nombre),
        apellidos: getTrimmedValue(row.apellidos) || undefined,
        email: getTrimmedValue(row.email) || undefined,
        telefono: getTrimmedValue(row.telefono) || undefined,
        telefonoSecundario: getTrimmedValue(row.telefonoSecundario) || undefined,
        idiomaPreferencia: getTrimmedValue(row.idiomaPreferencia) || undefined,
        estadoCuenta: getTrimmedValue(row.estadoCuenta) || undefined,
        tipoCliente: getTrimmedValue(row.tipoCliente) || undefined,
        allowWeekendBooking: getTrimmedValue(row.allowWeekendBooking) || undefined,
        direccionLinea1: getTrimmedValue(row.direccionLinea1) || undefined,
        direccionLinea2: getTrimmedValue(row.direccionLinea2) || undefined,
        ciudad: getTrimmedValue(row.ciudad) || undefined,
        estadoProvincia: getTrimmedValue(row.estadoProvincia) || undefined,
        codigoPostal: getTrimmedValue(row.codigoPostal) || undefined,
        notas: getTrimmedValue(row.notas) || undefined,
        linkedUser:
          getTrimmedValue(row.linkedUserEmail) || getTrimmedValue(row.linkedUserIsActive)
            ? {
                email: getTrimmedValue(row.linkedUserEmail) || undefined,
                isActive: getTrimmedValue(row.linkedUserIsActive) || undefined,
              }
            : undefined,
        properties: [],
      } satisfies CustomerTransferPayload["customers"][number]);

    if (!existing.nombre) {
      existing.nombre = getTrimmedValue(row.nombre);
    }
    if (!existing.apellidos) {
      existing.apellidos = getTrimmedValue(row.apellidos) || undefined;
    }
    if (!existing.email) {
      existing.email = getTrimmedValue(row.email) || undefined;
    }
    if (!existing.telefono) {
      existing.telefono = getTrimmedValue(row.telefono) || undefined;
    }
    if (!existing.telefonoSecundario) {
      existing.telefonoSecundario = getTrimmedValue(row.telefonoSecundario) || undefined;
    }
    if (!existing.idiomaPreferencia) {
      existing.idiomaPreferencia = getTrimmedValue(row.idiomaPreferencia) || undefined;
    }
    if (!existing.estadoCuenta) {
      existing.estadoCuenta = getTrimmedValue(row.estadoCuenta) || undefined;
    }
    if (!existing.tipoCliente) {
      existing.tipoCliente = getTrimmedValue(row.tipoCliente) || undefined;
    }
    if (!existing.allowWeekendBooking) {
      existing.allowWeekendBooking =
        getTrimmedValue(row.allowWeekendBooking) || undefined;
    }
    if (!existing.direccionLinea1) {
      existing.direccionLinea1 = getTrimmedValue(row.direccionLinea1) || undefined;
    }
    if (!existing.direccionLinea2) {
      existing.direccionLinea2 = getTrimmedValue(row.direccionLinea2) || undefined;
    }
    if (!existing.ciudad) {
      existing.ciudad = getTrimmedValue(row.ciudad) || undefined;
    }
    if (!existing.estadoProvincia) {
      existing.estadoProvincia = getTrimmedValue(row.estadoProvincia) || undefined;
    }
    if (!existing.codigoPostal) {
      existing.codigoPostal = getTrimmedValue(row.codigoPostal) || undefined;
    }
    if (!existing.notas) {
      existing.notas = getTrimmedValue(row.notas) || undefined;
    }

    const propertyFields = [
      "sourcePropertyId",
      "propertyName",
      "propertyAddress",
      "poolType",
      "poolVolumeGallons",
      "sanitizerType",
      "filterType",
      "hasSpa",
      "accessLocationNotes",
      "serviceStartDate",
      "paymentDay",
      "servicePrice",
      "paymentType",
      "paymentNotes",
    ] as const;
    const hasPropertyData = propertyFields.some(
      (field) => getTrimmedValue(row[field]).length > 0
    );

    if (hasPropertyData) {
      existing.properties = existing.properties ?? [];
      existing.properties.push({
        sourcePropertyId: getTrimmedValue(row.sourcePropertyId) || undefined,
        name: getTrimmedValue(row.propertyName) || undefined,
        address: getTrimmedValue(row.propertyAddress),
        poolType: getTrimmedValue(row.poolType) || undefined,
        poolVolumeGallons: getTrimmedValue(row.poolVolumeGallons) || undefined,
        sanitizerType: getTrimmedValue(row.sanitizerType) || undefined,
        filterType: getTrimmedValue(row.filterType) || undefined,
        hasSpa: getTrimmedValue(row.hasSpa) || undefined,
        accessLocationNotes: getTrimmedValue(row.accessLocationNotes) || undefined,
        serviceStartDate: getTrimmedValue(row.serviceStartDate) || undefined,
        paymentDay: getTrimmedValue(row.paymentDay) || undefined,
        servicePrice: getTrimmedValue(row.servicePrice) || undefined,
        paymentType: getTrimmedValue(row.paymentType) || undefined,
        paymentNotes: getTrimmedValue(row.paymentNotes) || undefined,
      });
    }

    grouped.set(groupKey, existing);
  }

  return Array.from(grouped.values());
}

export function buildCustomerTransferPayloadFromTableRows(
  inputRows: Array<Record<string, unknown>>
) {
  const normalizedRows = inputRows
    .map((row) => {
      const normalized = {} as CustomerTransferTableRow;
      for (const column of CUSTOMER_TRANSFER_TABLE_COLUMNS) {
        normalized[column] = toCellValue(row[column]);
      }
      return normalized;
    })
    .filter((row) =>
      CUSTOMER_TRANSFER_TABLE_COLUMNS.some(
        (column) => getTrimmedValue(row[column]).length > 0
      )
    );

  const payload = {
    format: CUSTOMER_TRANSFER_FORMAT,
    totals: {
      customers: 0,
      properties: 0,
    },
    customers: groupCustomerRows(normalizedRows),
  } satisfies CustomerTransferPayload;

  payload.totals.customers = payload.customers.length;
  payload.totals.properties = payload.customers.reduce(
    (sum, customer) => sum + (customer.properties?.length ?? 0),
    0
  );

  return customerTransferPayloadSchema.parse(payload);
}

export function parseCustomerTransferCsv(text: string) {
  const matrix = decodeCsvMatrix(text);
  if (matrix.length === 0) {
    throw new Error("El archivo CSV no contiene filas para importar.");
  }

  return parseCustomerTransferTableMatrix(
    matrix[0].map((cell) => getTrimmedValue(cell)),
    matrix.slice(1)
  );
}

export function parseCustomerTransferTableMatrix(
  headers: string[],
  matrixRows: string[][]
) {
  const normalizedHeaders = headers.map((header) => getTrimmedValue(header));
  assertExpectedHeaders(normalizedHeaders);

  const rows = matrixRows.map((cells) => {
    const row: Record<string, unknown> = {};
    normalizedHeaders.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });

  return buildCustomerTransferPayloadFromTableRows(rows);
}
