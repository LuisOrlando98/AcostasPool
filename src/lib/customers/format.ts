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
