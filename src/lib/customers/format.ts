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
 * Indicador de propiedad para rutas y calendarios. Solo existe cuando el
 * cliente tiene más de una propiedad (con una sola no aporta nada): el nombre
 * que puso el administrador y, si aún no lo tiene, la calle de la dirección,
 * para que el técnico siempre sepa a cuál ir.
 */
export function getPropertyIndicator(
  property: PropertyLabelParts,
  hasMultipleProperties: boolean
): string | null {
  if (!hasMultipleProperties) {
    return null;
  }
  return formatPropertyLabel(property) || null;
}

/**
 * Título de un trabajo en tarjetas y listas: "Cliente · Indicador" cuando hay
 * indicador de propiedad (p. ej. "Parplace · Parplace 2"); solo el cliente en
 * caso contrario, porque la dirección ya se muestra debajo.
 */
export function formatJobTitle(customerName: string, indicator: string | null): string {
  return indicator ? `${customerName} · ${indicator}` : customerName;
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
