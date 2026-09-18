import { prisma } from "@/lib/db";

/**
 * Filas de pruebas de la vista de desarrollador.
 *
 * La vista de desarrollador NO usa credenciales ajenas: al mirar la app como
 * técnico o como cliente la sesión sigue siendo la del desarrollador y solo
 * cambia el rol. Para que las páginas de esas vistas (que buscan su fila por
 * `userId`) encuentren datos, el desarrollador tiene su propio `Technician` y
 * su propio `Customer` con una `Property` de pruebas.
 *
 * Todo es idempotente (`upsert` por `userId`): al volver a cambiar de vista se
 * reutiliza lo que ya exista y nunca se pisan los datos del desarrollador.
 *
 * Estas filas SON reales y aparecen en los listados de administración; por eso
 * llevan la marca `(pruebas)` en los apellidos del cliente y la nota
 * `DEV_TEST_RECORD_NOTES` en técnico y cliente.
 */

/** Marca que identifica estas filas en los listados de administración. */
export const DEV_TEST_RECORD_NOTES = "Cuenta de pruebas del desarrollador";
/** Sufijo del nombre del cliente de pruebas, visible en los listados. */
export const DEV_TEST_CUSTOMER_SURNAME = "(pruebas)";
/** Mismo color por defecto que ofrece el formulario de técnicos. */
export const DEV_TEST_TECHNICIAN_COLOR_HEX = "#38bdf8";
/** Teléfono de relleno (igual que el de `scripts/seed.cjs`). */
export const DEV_TEST_PHONE = "+1 000-000-0000";

export const DEV_TEST_PROPERTY_NAME = "Propiedad de pruebas";
export const DEV_TEST_PROPERTY_ADDRESS = "123 Test St, Miami, FL";
const DEV_TEST_ADDRESS_LINE = "123 Test St";
const DEV_TEST_CITY = "Miami";
const DEV_TEST_STATE = "FL";

export type DeveloperTechnicianRecord = {
  readonly technicianId: string;
};

export type DeveloperCustomerRecord = {
  readonly customerId: string;
  readonly propertyId: string;
};

/**
 * Fila `Technician` del propio desarrollador. Se crea la primera vez que
 * cambia a la vista de técnico y se reutiliza después.
 */
export async function ensureDeveloperTechnician(
  userId: string
): Promise<DeveloperTechnicianRecord> {
  const technician = await prisma.technician.upsert({
    where: { userId },
    create: {
      userId,
      phone: DEV_TEST_PHONE,
      notes: DEV_TEST_RECORD_NOTES,
      colorHex: DEV_TEST_TECHNICIAN_COLOR_HEX,
    },
    update: {},
    select: { id: true },
  });
  return { technicianId: technician.id };
}

/**
 * Fila `Customer` del propio desarrollador, con UNA propiedad de pruebas. El
 * nombre y el idioma salen de su usuario, de modo que la ficha se reconoce a
 * simple vista, y los apellidos llevan la marca `(pruebas)`.
 */
export async function ensureDeveloperCustomer(
  userId: string
): Promise<DeveloperCustomerRecord> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, fullName: true, locale: true },
  });
  if (!user) {
    throw new Error(`Developer user ${userId} not found`);
  }

  const customer = await prisma.customer.upsert({
    where: { userId },
    create: {
      userId,
      nombre: user.fullName,
      apellidos: DEV_TEST_CUSTOMER_SURNAME,
      email: user.email,
      telefono: DEV_TEST_PHONE,
      idiomaPreferencia: user.locale,
      estadoCuenta: "ACTIVE",
      tipoCliente: "RESIDENTIAL",
      direccionLinea1: DEV_TEST_ADDRESS_LINE,
      ciudad: DEV_TEST_CITY,
      estadoProvincia: DEV_TEST_STATE,
      notas: DEV_TEST_RECORD_NOTES,
    },
    update: {},
    select: { id: true },
  });

  const existingProperty = await prisma.property.findFirst({
    where: { customerId: customer.id, address: DEV_TEST_PROPERTY_ADDRESS },
    select: { id: true },
  });
  if (existingProperty) {
    return { customerId: customer.id, propertyId: existingProperty.id };
  }

  const property = await prisma.property.create({
    data: {
      customerId: customer.id,
      name: DEV_TEST_PROPERTY_NAME,
      address: DEV_TEST_PROPERTY_ADDRESS,
    },
    select: { id: true },
  });
  return { customerId: customer.id, propertyId: property.id };
}
