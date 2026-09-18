import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { customerTransferPayloadSchema } from "@/lib/customers/transfer";
import {
  getCustomerTransferDisplayName,
  sanitizeImportedTransferCustomer,
  type CustomerTransferPayload,
  type ImportedTransferCustomer,
} from "@/lib/customers/transfer";
import {
  parseCustomerTransferCsv,
  parseCustomerTransferTableMatrix,
} from "@/lib/customers/transfer-table";
import { logAuditEvent } from "@/lib/audit/log";
import { formatCustomerName } from "@/lib/customers/format";
import { parseWorkbookXlsx } from "@/lib/spreadsheets/xlsx";

export const runtime = "nodejs";

type ImportIssue = {
  customer: string;
  message: string;
};

type PreparedTransferCustomer = {
  customerLabel: string;
  sanitized: ImportedTransferCustomer | null;
  error: unknown;
};

type ExistingTransferUser = {
  id: string;
  email: string;
  role: Role;
  customer: { id: string } | null;
};

function asErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Error inesperado durante el import.";
}

function toImportIssue(customer: string, error: unknown): ImportIssue {
  return { customer, message: asErrorMessage(error) };
}

async function readImportPayload(
  fileEntry: File | null,
  payloadEntry: FormDataEntryValue | null
) {
  const fileName = fileEntry?.name.toLowerCase() ?? "";
  const fileType = fileEntry?.type ?? "";
  const isXlsx =
    fileName.endsWith(".xlsx") ||
    fileType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const isCsv = fileName.endsWith(".csv") || fileType === "text/csv";

  if (fileEntry && isXlsx) {
    const workbook = parseWorkbookXlsx(Buffer.from(await fileEntry.arrayBuffer()));
    return parseCustomerTransferTableMatrix(workbook.headers, workbook.rows);
  }

  const rawText =
    fileEntry instanceof File
      ? await fileEntry.text()
      : typeof payloadEntry === "string"
        ? payloadEntry.trim()
        : "";

  if (!rawText) {
    throw new Error("Debes subir un archivo JSON, CSV o XLSX.");
  }

  if (fileEntry && isCsv) {
    return parseCustomerTransferCsv(rawText);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    if (fileEntry && !fileName.endsWith(".json")) {
      throw new Error(
        "No se pudo identificar el formato del archivo. Usa JSON, CSV o XLSX."
      );
    }
    throw new Error("El archivo no contiene JSON valido.");
  }

  return customerTransferPayloadSchema.parse(parsedJson);
}

async function prepareTransferCustomer(
  item: CustomerTransferPayload["customers"][number]
): Promise<PreparedTransferCustomer> {
  const customerLabel = getCustomerTransferDisplayName(item);
  try {
    const sanitized = await sanitizeImportedTransferCustomer(item);
    return { customerLabel, sanitized, error: null };
  } catch (error) {
    return { customerLabel, sanitized: null, error };
  }
}

// Secuencial a proposito: la normalizacion de direcciones puede llamar a una API externa.
function prepareTransferCustomers(items: CustomerTransferPayload["customers"]) {
  return items.reduce<Promise<PreparedTransferCustomer[]>>(
    async (previous, item) => [
      ...(await previous),
      await prepareTransferCustomer(item),
    ],
    Promise.resolve([])
  );
}

function uniqueNonEmpty(values: Array<string | null>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

async function findExistingCustomerIds(ids: string[]) {
  if (ids.length === 0) {
    return new Set<string>();
  }
  const customers = await prisma.customer.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return new Set(customers.map((customer) => customer.id));
}

async function findExistingCustomerEmails(emails: string[]) {
  if (emails.length === 0) {
    return new Set<string>();
  }
  const customers = await prisma.customer.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  return new Set(customers.map((customer) => customer.email));
}

async function findUsersByEmail(emails: string[]) {
  if (emails.length === 0) {
    return new Map<string, ExistingTransferUser>();
  }
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: {
      id: true,
      email: true,
      role: true,
      customer: { select: { id: true } },
    },
  });
  return new Map<string, ExistingTransferUser>(
    users.map((user) => [user.email, user])
  );
}

async function loadExistingRecords(customers: ImportedTransferCustomer[]) {
  const emails = uniqueNonEmpty(customers.map((customer) => customer.email));
  const sourceCustomerIds = uniqueNonEmpty(
    customers.map((customer) => customer.sourceCustomerId)
  );
  const [existingCustomerIds, existingCustomerEmails, usersByEmail] =
    await Promise.all([
      findExistingCustomerIds(sourceCustomerIds),
      findExistingCustomerEmails(emails),
      findUsersByEmail(emails),
    ]);
  return { existingCustomerIds, existingCustomerEmails, usersByEmail };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.isDeveloper) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const fileEntry = formData.get("file");
  const payloadEntry = formData.get("payload");
  const file = fileEntry instanceof File ? fileEntry : null;
  let payloadResult;
  try {
    payloadResult = customerTransferPayloadSchema.safeParse(
      await readImportPayload(file, payloadEntry)
    );
  } catch (error) {
    return Response.json(
      {
        error: asErrorMessage(error),
      },
      { status: 400 }
    );
  }

  if (!payloadResult.success) {
    return Response.json(
      {
        error: "El archivo no cumple con el formato esperado.",
        details: payloadResult.error.issues.map((issue) => issue.message),
      },
      { status: 400 }
    );
  }

  const preparedCustomers = await prepareTransferCustomers(
    payloadResult.data.customers
  );
  const sanitizedCustomers = preparedCustomers.flatMap((prepared) =>
    prepared.sanitized ? [prepared.sanitized] : []
  );

  let existing;
  try {
    existing = await loadExistingRecords(sanitizedCustomers);
  } catch (error) {
    console.error("Customer transfer import lookup failed:", error);
    return Response.json(
      { error: "No se pudieron consultar los clientes existentes." },
      { status: 500 }
    );
  }
  const { existingCustomerIds, existingCustomerEmails, usersByEmail } = existing;

  const summary = {
    totalEntries: payloadResult.data.customers.length,
    createdCustomers: 0,
    skippedCustomers: 0,
    createdProperties: 0,
    skippedProperties: 0,
    errorCount: 0,
  };
  const issues: ImportIssue[] = [];
  const seenSourceCustomerIds = new Set<string>();
  const seenEmails = new Set<string>();

  for (const { customerLabel, sanitized, error } of preparedCustomers) {
    if (!sanitized) {
      summary.errorCount += 1;
      issues.push(toImportIssue(customerLabel, error));
      continue;
    }

    try {
      if (
        sanitized.sourceCustomerId &&
        seenSourceCustomerIds.has(sanitized.sourceCustomerId)
      ) {
        summary.skippedCustomers += 1;
        issues.push({
          customer: customerLabel,
          message: "sourceCustomerId duplicado dentro del archivo.",
        });
        continue;
      }
      if (sanitized.sourceCustomerId) {
        seenSourceCustomerIds.add(sanitized.sourceCustomerId);
      }

      if (sanitized.email && seenEmails.has(sanitized.email)) {
        summary.skippedCustomers += 1;
        issues.push({
          customer: customerLabel,
          message: "Email duplicado dentro del archivo.",
        });
        continue;
      }
      if (sanitized.email) {
        seenEmails.add(sanitized.email);
      }

      if (
        sanitized.sourceCustomerId &&
        existingCustomerIds.has(sanitized.sourceCustomerId)
      ) {
        summary.skippedCustomers += 1;
        continue;
      }

      if (sanitized.email && existingCustomerEmails.has(sanitized.email)) {
        summary.skippedCustomers += 1;
        continue;
      }

      const existingUser = sanitized.email
        ? (usersByEmail.get(sanitized.email) ?? null)
        : null;

      if (existingUser && existingUser.role !== "CUSTOMER") {
        throw new Error("El email ya esta asignado a un usuario de otro rol.");
      }

      if (existingUser?.customer) {
        summary.skippedCustomers += 1;
        continue;
      }

      const seenPropertyAddresses = new Set<string>();
      const uniqueProperties = sanitized.properties.filter((property) => {
        const key = property.address.trim().toLowerCase();
        if (seenPropertyAddresses.has(key)) {
          return false;
        }
        seenPropertyAddresses.add(key);
        return true;
      });

      const skippedPropertiesForCustomer =
        sanitized.properties.length - uniqueProperties.length;

      const createdProperties = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: {
            userId: existingUser?.id ?? null,
            nombre: sanitized.nombre,
            apellidos: sanitized.apellidos,
            email: sanitized.email,
            telefono: sanitized.telefono,
            telefonoSecundario: sanitized.telefonoSecundario,
            idiomaPreferencia: sanitized.idiomaPreferencia,
            estadoCuenta: sanitized.estadoCuenta,
            tipoCliente: sanitized.tipoCliente,
            allowWeekendBooking: sanitized.allowWeekendBooking,
            direccionLinea1: sanitized.direccionLinea1,
            direccionLinea2: sanitized.direccionLinea2,
            ciudad: sanitized.ciudad,
            estadoProvincia: sanitized.estadoProvincia,
            codigoPostal: sanitized.codigoPostal,
            notas: sanitized.notas,
          },
        });

        if (existingUser?.id) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              fullName: formatCustomerName(sanitized),
              locale: sanitized.idiomaPreferencia,
              isActive: sanitized.estadoCuenta === "ACTIVE",
            },
          });
        }

        let createdCount = 0;
        for (const property of uniqueProperties) {
          await tx.property.create({
            data: {
              customerId: customer.id,
              name: property.name,
              address: property.address,
              poolType: property.poolType,
              poolVolumeGallons: property.poolVolumeGallons,
              sanitizerType: property.sanitizerType,
              filterType: property.filterType,
              hasSpa: property.hasSpa,
              accessInfo: property.accessLocationNotes,
              serviceStartDate: property.serviceStartDate,
              paymentDay: property.paymentDay,
              servicePrice: property.servicePrice,
              paymentType: property.paymentType,
              paymentNotes: property.paymentNotes,
            },
          });
          createdCount += 1;
        }

        return createdCount;
      });

      summary.createdCustomers += 1;
      summary.createdProperties += createdProperties;
      summary.skippedProperties += skippedPropertiesForCustomer;
    } catch (error) {
      summary.errorCount += 1;
      issues.push(toImportIssue(customerLabel, error));
    }
  }

  await logAuditEvent({
    userId: session.sub,
    action: "CUSTOMER_TRANSFER_IMPORTED",
    entity: "CustomerTransfer",
    metadata: {
      fileName: file?.name ?? null,
      ...summary,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/developer");

  return Response.json({
    ok: true,
    summary,
    issues,
  });
}
