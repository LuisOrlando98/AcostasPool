import { z } from "zod";
import { normalizeEmail } from "@/lib/auth/email";
import {
  normalizeServicePaymentType,
  type ServicePaymentType,
} from "@/lib/customers/service-payment-info";
import { normalizeUsPhone } from "@/lib/phones";
import { normalizePropertyAddress } from "@/lib/routing/address";
import { parseBusinessDateInput } from "@/lib/timezone";

export const CUSTOMER_TRANSFER_FORMAT = "acostaspool.customers.v1";

const customerTransferPropertySchema = z.object({
  sourcePropertyId: z.unknown().optional(),
  name: z.unknown().optional(),
  address: z.unknown(),
  poolType: z.unknown().optional(),
  poolVolumeGallons: z.unknown().optional(),
  sanitizerType: z.unknown().optional(),
  filterType: z.unknown().optional(),
  hasSpa: z.unknown().optional(),
  accessLocationNotes: z.unknown().optional(),
  serviceStartDate: z.unknown().optional(),
  paymentDay: z.unknown().optional(),
  servicePrice: z.unknown().optional(),
  paymentType: z.unknown().optional(),
  paymentNotes: z.unknown().optional(),
});

const customerTransferCustomerSchema = z.object({
  sourceCustomerId: z.unknown().optional(),
  nombre: z.unknown(),
  apellidos: z.unknown().optional(),
  email: z.unknown().optional(),
  telefono: z.unknown().optional(),
  telefonoSecundario: z.unknown().optional(),
  idiomaPreferencia: z.unknown().optional(),
  estadoCuenta: z.unknown().optional(),
  tipoCliente: z.unknown().optional(),
  allowWeekendBooking: z.unknown().optional(),
  direccionLinea1: z.unknown().optional(),
  direccionLinea2: z.unknown().optional(),
  ciudad: z.unknown().optional(),
  estadoProvincia: z.unknown().optional(),
  codigoPostal: z.unknown().optional(),
  notas: z.unknown().optional(),
  linkedUser: z
    .object({
      email: z.unknown().optional(),
      isActive: z.unknown().optional(),
    })
    .nullable()
    .optional(),
  properties: z.array(customerTransferPropertySchema).optional(),
});

export const customerTransferPayloadSchema = z.object({
  format: z.literal(CUSTOMER_TRANSFER_FORMAT),
  exportedAt: z.string().optional(),
  totals: z
    .object({
      customers: z.number().int().nonnegative().optional(),
      properties: z.number().int().nonnegative().optional(),
    })
    .optional(),
  customers: z.array(customerTransferCustomerSchema),
});

export type CustomerTransferPayload = z.infer<
  typeof customerTransferPayloadSchema
>;

export type ImportedTransferProperty = {
  sourcePropertyId: string | null;
  name: string | null;
  address: string;
  poolType: string | null;
  poolVolumeGallons: number | null;
  sanitizerType: string | null;
  filterType: string | null;
  hasSpa: boolean;
  accessLocationNotes: string | null;
  serviceStartDate: Date | null;
  paymentDay: number | null;
  servicePrice: number | null;
  paymentType: ServicePaymentType | null;
  paymentNotes: string | null;
};

export type ImportedTransferCustomer = {
  sourceCustomerId: string | null;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  telefonoSecundario: string | null;
  idiomaPreferencia: "EN" | "ES";
  estadoCuenta: "ACTIVE" | "INACTIVE";
  tipoCliente: "RESIDENTIAL" | "COMMERCIAL";
  allowWeekendBooking: boolean;
  direccionLinea1: string | null;
  direccionLinea2: string | null;
  ciudad: string | null;
  estadoProvincia: string | null;
  codigoPostal: string | null;
  notas: string | null;
  properties: ImportedTransferProperty[];
};

function asOptionalString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function asIdentifier(value: unknown) {
  return asOptionalString(value);
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "si", "s"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function asInteger(
  value: unknown,
  label: string,
  { min, max }: { min?: number; max?: number } = {}
) {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : null;

  if (raw === null) {
    return null;
  }
  if (!Number.isInteger(raw)) {
    throw new Error(`${label} debe ser un numero entero.`);
  }
  if (typeof min === "number" && raw < min) {
    throw new Error(`${label} debe ser mayor o igual a ${min}.`);
  }
  if (typeof max === "number" && raw > max) {
    throw new Error(`${label} debe ser menor o igual a ${max}.`);
  }
  return raw;
}

function asNumber(value: unknown, label: string) {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : null;

  if (raw === null) {
    return null;
  }
  if (!Number.isFinite(raw)) {
    throw new Error(`${label} debe ser un numero valido.`);
  }
  if (raw < 0) {
    throw new Error(`${label} no puede ser negativo.`);
  }
  return Math.round(raw * 100) / 100;
}

function asLocale(value: unknown) {
  return asOptionalString(value)?.toUpperCase() === "ES" ? "ES" : "EN";
}

function asAccountStatus(value: unknown) {
  return asOptionalString(value)?.toUpperCase() === "INACTIVE"
    ? "INACTIVE"
    : "ACTIVE";
}

function asCustomerType(value: unknown) {
  return asOptionalString(value)?.toUpperCase() === "COMMERCIAL"
    ? "COMMERCIAL"
    : "RESIDENTIAL";
}

function normalizePhone(value: unknown, label: string) {
  const raw = asOptionalString(value);
  if (!raw) {
    return null;
  }
  const normalized = normalizeUsPhone(raw);
  if (!normalized) {
    throw new Error(`${label} no tiene un formato valido.`);
  }
  return normalized;
}

function parsePaymentType(value: unknown) {
  const raw = asOptionalString(value);
  if (!raw) {
    return null;
  }
  const normalized = normalizeServicePaymentType(raw);
  if (!normalized) {
    throw new Error("paymentType no es valido.");
  }
  return normalized;
}

function parseServiceStartDate(value: unknown) {
  const raw = asOptionalString(value);
  if (!raw) {
    return null;
  }
  const parsed = parseBusinessDateInput(raw);
  if (!parsed) {
    throw new Error("serviceStartDate debe usar el formato YYYY-MM-DD.");
  }
  return parsed;
}

export function getCustomerTransferDisplayName(input: {
  sourceCustomerId?: unknown;
  nombre?: unknown;
  apellidos?: unknown;
  email?: unknown;
}) {
  const nombre = asOptionalString(input.nombre);
  const apellidos = asOptionalString(input.apellidos);
  const email = asOptionalString(input.email);
  const sourceCustomerId = asIdentifier(input.sourceCustomerId);
  const fullName = [nombre, apellidos].filter(Boolean).join(" ");

  return fullName || email || sourceCustomerId || "Cliente";
}

export async function sanitizeImportedTransferCustomer(
  input: CustomerTransferPayload["customers"][number]
): Promise<ImportedTransferCustomer> {
  const nombre = asOptionalString(input.nombre);
  if (!nombre) {
    throw new Error("nombre es obligatorio.");
  }

  const emailRaw = asOptionalString(input.email);
  const email = emailRaw ? normalizeEmail(emailRaw) : "";
  const telefono = normalizePhone(input.telefono, "telefono") ?? "";
  const telefonoSecundario = normalizePhone(
    input.telefonoSecundario,
    "telefonoSecundario"
  );

  const properties = await Promise.all(
    (input.properties ?? []).map(async (property) => {
      const rawAddress = asOptionalString(property.address);
      if (!rawAddress) {
        throw new Error("Cada propiedad necesita address.");
      }

      const normalizedAddress = await normalizePropertyAddress(rawAddress);

      return {
        sourcePropertyId: asIdentifier(property.sourcePropertyId),
        name: asOptionalString(property.name),
        address: normalizedAddress,
        poolType: asOptionalString(property.poolType),
        poolVolumeGallons: asInteger(
          property.poolVolumeGallons,
          "poolVolumeGallons",
          { min: 0 }
        ),
        sanitizerType: asOptionalString(property.sanitizerType),
        filterType: asOptionalString(property.filterType),
        hasSpa: asBoolean(property.hasSpa, false),
        accessLocationNotes: asOptionalString(property.accessLocationNotes),
        serviceStartDate: parseServiceStartDate(property.serviceStartDate),
        paymentDay: asInteger(property.paymentDay, "paymentDay", {
          min: 1,
          max: 31,
        }),
        servicePrice: asNumber(property.servicePrice, "servicePrice"),
        paymentType: parsePaymentType(property.paymentType),
        paymentNotes: asOptionalString(property.paymentNotes),
      } satisfies ImportedTransferProperty;
    })
  );

  return {
    sourceCustomerId: asIdentifier(input.sourceCustomerId),
    nombre,
    apellidos: asOptionalString(input.apellidos) ?? "",
    email,
    telefono,
    telefonoSecundario,
    idiomaPreferencia: asLocale(input.idiomaPreferencia),
    estadoCuenta: asAccountStatus(input.estadoCuenta),
    tipoCliente: asCustomerType(input.tipoCliente),
    allowWeekendBooking: asBoolean(input.allowWeekendBooking, false),
    direccionLinea1: asOptionalString(input.direccionLinea1),
    direccionLinea2: asOptionalString(input.direccionLinea2),
    ciudad: asOptionalString(input.ciudad),
    estadoProvincia: asOptionalString(input.estadoProvincia),
    codigoPostal: asOptionalString(input.codigoPostal),
    notas: asOptionalString(input.notas),
    properties,
  };
}
