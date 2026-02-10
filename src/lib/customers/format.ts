export type CustomerNameParts = {
  nombre?: string | null;
  apellidos?: string | null;
  email?: string | null;
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
