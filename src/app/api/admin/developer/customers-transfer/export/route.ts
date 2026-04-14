import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CUSTOMER_TRANSFER_FORMAT } from "@/lib/customers/transfer";
import {
  CUSTOMER_TRANSFER_SHEET_NAME,
  CUSTOMER_TRANSFER_TABLE_COLUMNS,
  encodeCustomerTransferCsv,
  flattenCustomerTransferPayload,
} from "@/lib/customers/transfer-table";
import { formatBusinessDateInput } from "@/lib/timezone";
import { logAuditEvent } from "@/lib/audit/log";
import { createWorkbookXlsx } from "@/lib/spreadsheets/xlsx";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.isDeveloper) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedFormat = searchParams.get("format");
  const exportFormat =
    requestedFormat === "csv" || requestedFormat === "xlsx"
      ? requestedFormat
      : "json";

  const customers = await prisma.customer.findMany({
    orderBy: [{ nombre: "asc" }, { apellidos: "asc" }],
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      email: true,
      telefono: true,
      telefonoSecundario: true,
      idiomaPreferencia: true,
      estadoCuenta: true,
      tipoCliente: true,
      allowWeekendBooking: true,
      direccionLinea1: true,
      direccionLinea2: true,
      ciudad: true,
      estadoProvincia: true,
      codigoPostal: true,
      notas: true,
      user: {
        select: {
          email: true,
          isActive: true,
        },
      },
      properties: {
        orderBy: [{ createdAt: "asc" }, { address: "asc" }],
        select: {
          id: true,
          name: true,
          address: true,
          poolType: true,
          poolVolumeGallons: true,
          sanitizerType: true,
          filterType: true,
          hasSpa: true,
          accessInfo: true,
          locationNotes: true,
          serviceStartDate: true,
          paymentDay: true,
          servicePrice: true,
          paymentType: true,
          paymentNotes: true,
        },
      },
    },
  });

  const payload = {
    format: CUSTOMER_TRANSFER_FORMAT,
    exportedAt: new Date().toISOString(),
    totals: {
      customers: customers.length,
      properties: customers.reduce(
        (sum, customer) => sum + customer.properties.length,
        0
      ),
    },
    customers: customers.map((customer) => ({
      sourceCustomerId: customer.id,
      nombre: customer.nombre,
      apellidos: customer.apellidos,
      email: customer.email,
      telefono: customer.telefono,
      telefonoSecundario: customer.telefonoSecundario,
      idiomaPreferencia: customer.idiomaPreferencia,
      estadoCuenta: customer.estadoCuenta,
      tipoCliente: customer.tipoCliente,
      allowWeekendBooking: customer.allowWeekendBooking,
      direccionLinea1: customer.direccionLinea1,
      direccionLinea2: customer.direccionLinea2,
      ciudad: customer.ciudad,
      estadoProvincia: customer.estadoProvincia,
      codigoPostal: customer.codigoPostal,
      notas: customer.notas,
      linkedUser: customer.user
        ? {
            email: customer.user.email,
            isActive: customer.user.isActive,
          }
        : null,
      properties: customer.properties.map((property) => ({
        sourcePropertyId: property.id,
        name: property.name,
        address: property.address,
        poolType: property.poolType,
        poolVolumeGallons: property.poolVolumeGallons,
        sanitizerType: property.sanitizerType,
        filterType: property.filterType,
        hasSpa: property.hasSpa,
        accessLocationNotes:
          [property.accessInfo, property.locationNotes]
            .filter((value) => Boolean(value?.trim()))
            .join("\n\n") || null,
        serviceStartDate: property.serviceStartDate
          ? formatBusinessDateInput(property.serviceStartDate)
          : null,
        paymentDay: property.paymentDay,
        servicePrice:
          property.servicePrice !== null ? Number(property.servicePrice) : null,
        paymentType: property.paymentType,
        paymentNotes: property.paymentNotes,
      })),
    })),
  };

  await logAuditEvent({
    userId: session.sub,
    action: "CUSTOMER_TRANSFER_EXPORTED",
    entity: "CustomerTransfer",
    metadata: {
      format: exportFormat,
      ...payload.totals,
    },
  });

  const dateLabel = formatBusinessDateInput(new Date());

  if (exportFormat === "csv") {
    const filename = `customers-export-${dateLabel}.csv`;

    return new Response(encodeCustomerTransferCsv(payload), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (exportFormat === "xlsx") {
    const rows = flattenCustomerTransferPayload(payload).map((row) =>
      CUSTOMER_TRANSFER_TABLE_COLUMNS.map((column) => row[column] ?? "")
    );
    const workbook = createWorkbookXlsx({
      sheetName: CUSTOMER_TRANSFER_SHEET_NAME,
      headers: [...CUSTOMER_TRANSFER_TABLE_COLUMNS],
      rows,
    });
    const filename = `customers-export-${dateLabel}.xlsx`;

    return new Response(new Uint8Array(workbook), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const filename = `customers-export-${dateLabel}.json`;

  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
