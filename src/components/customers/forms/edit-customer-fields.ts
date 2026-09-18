import type { Customer } from "@prisma/client";

/**
 * Campos del cliente que edita `EditCustomerModal`. El modal es un client
 * component: la página debe pasarle solo estos datos (serializables) y no el
 * registro completo con sus relaciones (facturas con `Decimal`, tokens...).
 */
export type EditCustomerFields = Pick<
  Customer,
  | "id"
  | "nombre"
  | "apellidos"
  | "email"
  | "idiomaPreferencia"
  | "telefono"
  | "telefonoSecundario"
  | "estadoCuenta"
  | "tipoCliente"
  | "allowWeekendBooking"
  | "direccionLinea1"
  | "direccionLinea2"
  | "ciudad"
  | "estadoProvincia"
  | "codigoPostal"
  | "notas"
>;

export function pickEditCustomerFields(
  customer: EditCustomerFields
): EditCustomerFields {
  return {
    id: customer.id,
    nombre: customer.nombre,
    apellidos: customer.apellidos,
    email: customer.email,
    idiomaPreferencia: customer.idiomaPreferencia,
    telefono: customer.telefono,
    telefonoSecundario: customer.telefonoSecundario,
    estadoCuenta: customer.estadoCuenta,
    tipoCliente: customer.tipoCliente,
    allowWeekendBooking: customer.allowWeekendBooking,
    direccionLinea1: customer.direccionLinea1,
    direccionLinea2: customer.direccionLinea2,
    ciudad: customer.ciudad,
    estadoProvincia: customer.estadoProvincia,
    codigoPostal: customer.codigoPostal,
    notas: customer.notas,
  };
}
