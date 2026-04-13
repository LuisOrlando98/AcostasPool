import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CUSTOMER_TRANSFER_FORMAT } from "@/lib/customers/transfer";
import { formatBusinessDateInput } from "@/lib/timezone";
import { logAuditEvent } from "@/lib/audit/log";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || !session.isDeveloper) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    metadata: payload.totals,
  });

  const filename = `customers-export-${formatBusinessDateInput(new Date())}.json`;

  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
