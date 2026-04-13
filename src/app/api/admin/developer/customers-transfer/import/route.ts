import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { customerTransferPayloadSchema } from "@/lib/customers/transfer";
import {
  getCustomerTransferDisplayName,
  sanitizeImportedTransferCustomer,
} from "@/lib/customers/transfer";
import { logAuditEvent } from "@/lib/audit/log";
import { formatCustomerName } from "@/lib/customers/format";

export const runtime = "nodejs";

type ImportIssue = {
  customer: string;
  message: string;
};

function asErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Error inesperado durante el import.";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.isDeveloper) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const fileEntry = formData.get("file");
  const payloadEntry = formData.get("payload");

  const rawText =
    fileEntry instanceof File
      ? await fileEntry.text()
      : typeof payloadEntry === "string"
        ? payloadEntry.trim()
        : "";

  if (!rawText) {
    return Response.json(
      { error: "Debes subir un archivo JSON." },
      { status: 400 }
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return Response.json(
      { error: "El archivo no contiene JSON valido." },
      { status: 400 }
    );
  }

  const payloadResult = customerTransferPayloadSchema.safeParse(parsedJson);
  if (!payloadResult.success) {
    return Response.json(
      {
        error: "El archivo no cumple con el formato esperado.",
        details: payloadResult.error.issues.map((issue) => issue.message),
      },
      { status: 400 }
    );
  }

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

  for (const item of payloadResult.data.customers) {
    const customerLabel = getCustomerTransferDisplayName(item);

    try {
      const sanitized = await sanitizeImportedTransferCustomer(item);

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

      if (sanitized.sourceCustomerId) {
        const existingBySourceId = await prisma.customer.findUnique({
          where: { id: sanitized.sourceCustomerId },
          select: { id: true },
        });
        if (existingBySourceId) {
          summary.skippedCustomers += 1;
          continue;
        }
      }

      if (sanitized.email) {
        const existingCustomerByEmail = await prisma.customer.findFirst({
          where: {
            email: { equals: sanitized.email, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (existingCustomerByEmail) {
          summary.skippedCustomers += 1;
          continue;
        }
      }

      const existingUser = sanitized.email
        ? await prisma.user.findFirst({
            where: {
              email: { equals: sanitized.email, mode: "insensitive" },
            },
            select: {
              id: true,
              role: true,
              customer: { select: { id: true } },
            },
          })
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
      issues.push({
        customer: customerLabel,
        message: asErrorMessage(error),
      });
    }
  }

  await logAuditEvent({
    userId: session.sub,
    action: "CUSTOMER_TRANSFER_IMPORTED",
    entity: "CustomerTransfer",
    metadata: {
      fileName: fileEntry instanceof File ? fileEntry.name : null,
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
