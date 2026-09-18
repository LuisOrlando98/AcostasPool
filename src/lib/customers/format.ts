export type CustomerNameParts = {
  nombre?: string | null;
  apellidos?: string | null;
  email?: string | null;
};

export type CustomerAddressParts = {
  direccionLinea1?: string | null;
  direccionLinea2?: string | null;
  ciudad?: string | null;
  estadoProvincia?: string | null;
  codigoPostal?: string | null;
};

export function formatCustomerName(customer: CustomerNameParts) {
  const nombre = customer.nombre?.trim();
  const apellidos = customer.apellidos?.trim();
  const parts = [nombre, apellidos].filter(Boolean) as string[];
  if (parts.length > 0) {
    return parts.join(" ");
  }
  if (customer.email) {
    return customer.email;
  }
  return "Cliente";
}

export type PropertyLabelParts = {
  name?: string | null;
  address: string;
};

/**
 * Etiqueta corta de una propiedad: su nombre si lo tiene; si no, el primer
 * tramo de la dirección (la calle) y, en último término, `fallback`.
 */
export function formatPropertyLabel(property: PropertyLabelParts, fallback = ""): string {
  const name = property.name?.trim();
  if (name) {
    return name;
  }
  const street = property.address.split(",")[0]?.trim();
  return street || fallback;
}

/**
 * Título de un trabajo en tarjetas y listas: "Cliente · Propiedad" cuando la
 * propiedad tiene nombre (clientes con varias propiedades, p. ej.
 * "Parplace · Parplace 2"); solo el cliente cuando no lo tiene, porque la
 * dirección ya se muestra debajo.
 */
export function formatJobTitle(
  customerName: string,
  property: Pick<PropertyLabelParts, "name">
): string {
  const name = property.name?.trim();
  return name ? `${customerName} · ${name}` : customerName;
}

export function formatCustomerAddress(customer: CustomerAddressParts) {
  const line1 = customer.direccionLinea1?.trim() ?? "";
  const line2 = customer.direccionLinea2?.trim() ?? "";
  const city = customer.ciudad?.trim() ?? "";
  const state = customer.estadoProvincia?.trim() ?? "";
  const postal = customer.codigoPostal?.trim() ?? "";

  const cityStatePostal = [city, state].filter(Boolean).join(", ");
  const tail = [cityStatePostal, postal].filter(Boolean).join(" ");

  return [line1, line2, tail].filter(Boolean).join(", ");
}
