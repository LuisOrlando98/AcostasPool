import type {
  AccountStatus,
  CustomerType,
  JobPriority,
  JobType,
  Locale,
  ServiceType,
} from "@prisma/client";
import { z } from "zod";
import { normalizeEmail } from "@/lib/auth/email";
import { parseServicePaymentInfoInput } from "@/lib/customers/service-payment-info";
import { GLOBAL_RECURRING_PLAN_OPTIONS } from "@/lib/jobs/recurring-plan-templates";
import { normalizeUsPhone } from "@/lib/phones";
import { CUSTOMER_DETAIL_ERRORS, failure, type ActionResult } from "./action-result";
import { DELETE_CONFIRMATION_WORDS } from "./delete-confirmation";

/**
 * Esquemas zod de los formularios de la ficha de cliente. Reproducen las reglas
 * que las server actions aplicaban a mano (trim, valores por defecto, ternarios
 * de enumerados) y anotan cada fallo con una clave i18n en `message`.
 */

const DEFAULT_JOB_TIME = "09:00";
const EXPLICIT_SERVICE_TYPES: readonly ServiceType[] = [
  "FILTER_CHECK",
  "CHEM_BALANCE",
  "EQUIPMENT_CHECK",
];

function readFormFields(formData: FormData): Record<string, string> {
  const textEntries = Array.from(formData.entries()).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );
  return Object.fromEntries(textEntries);
}

type ParsedForm<T> =
  | { success: true; data: T }
  | { success: false; result: ActionResult };

/**
 * Valida el FormData con el esquema. Los issues con path van a `fieldErrors`;
 * el primer issue sin path (reglas de formulario) se convierte en el error
 * general; si no lo hay, el error general es `invalidInput`.
 */
export function parseFormData<Schema extends z.ZodTypeAny>(
  schema: Schema,
  formData: FormData
): ParsedForm<z.infer<Schema>> {
  const parsed = schema.safeParse(readFormFields(formData));
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  const issues = parsed.error.issues;
  const formIssue = issues.find((issue) => issue.path.length === 0);
  const fieldErrors = Object.fromEntries(
    issues
      .filter(
        (issue) =>
          issue.path.length > 0 &&
          issue.message !== CUSTOMER_DETAIL_ERRORS.invalidInput
      )
      .map((issue) => [String(issue.path[0]), issue.message])
  );
  return {
    success: false,
    result: failure(
      formIssue?.message ?? CUSTOMER_DETAIL_ERRORS.invalidInput,
      fieldErrors
    ),
  };
}

const textField = () => z.string().trim().default("");

const requiredText = (message: string) =>
  z
    .string({ required_error: message, invalid_type_error: message })
    .trim()
    .min(1, message);

/** Ids ocultos: si faltan el formulario está corrupto, no hay campo que señalar. */
const hiddenId = () => requiredText(CUSTOMER_DETAIL_ERRORS.invalidInput);

const optionalNonNegativeInt = (message: string) =>
  textField().transform((value, ctx) => {
    if (!value) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    }
    return parsed;
  });

const optionalUsPhone = (message: string) =>
  textField().transform((raw, ctx) => {
    if (!raw) {
      return "";
    }
    const normalized = normalizeUsPhone(raw);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    }
    return normalized;
  });

const yesNoField = () => textField().transform((value) => value === "yes");

const servicePaymentShape = {
  serviceStartDate: textField(),
  paymentDay: textField(),
  servicePrice: textField(),
  paymentType: textField(),
  paymentNotes: textField(),
};

const propertyShape = {
  customerId: hiddenId(),
  name: textField(),
  address: requiredText(CUSTOMER_DETAIL_ERRORS.propertyAddressRequired),
  poolType: textField(),
  poolVolumeGallons: optionalNonNegativeInt(CUSTOMER_DETAIL_ERRORS.poolVolumeInvalid),
  hasSpa: yesNoField(),
  sanitizerType: textField(),
  filterType: textField(),
  ...servicePaymentShape,
};

type ServicePaymentFields = z.infer<z.ZodObject<typeof servicePaymentShape>>;

function attachServicePaymentInfo<T extends ServicePaymentFields>(
  data: T,
  ctx: z.RefinementCtx
) {
  const servicePaymentInfo = parseServicePaymentInfoInput(data);
  if (!servicePaymentInfo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["servicePaymentInfo"],
      message: CUSTOMER_DETAIL_ERRORS.paymentInfoInvalid,
    });
    return z.NEVER;
  }
  return { ...data, servicePaymentInfo };
}

export const createPropertySchema = z
  .object({
    ...propertyShape,
    accessLocationNotes: requiredText(CUSTOMER_DETAIL_ERRORS.accessNotesRequired),
  })
  .transform(attachServicePaymentInfo);

export const updatePropertySchema = z
  .object({
    ...propertyShape,
    propertyId: hiddenId(),
    accessLocationNotes: textField(),
  })
  .transform(attachServicePaymentInfo);

export const updateCustomerSchema = z
  .object({
    customerId: hiddenId(),
    nombre: requiredText(CUSTOMER_DETAIL_ERRORS.firstNameRequired),
    apellidos: textField(),
    email: textField().transform(normalizeEmail),
    telefono: optionalUsPhone(CUSTOMER_DETAIL_ERRORS.phoneInvalid),
    telefonoSecundario: optionalUsPhone(CUSTOMER_DETAIL_ERRORS.secondaryPhoneInvalid),
    estadoCuenta: z
      .string()
      .default("ACTIVE")
      .transform((value): AccountStatus => (value === "INACTIVE" ? "INACTIVE" : "ACTIVE")),
    idiomaPreferencia: z
      .string()
      .default("EN")
      .transform((value): Locale => (value === "EN" ? "EN" : "ES")),
    tipoCliente: z
      .string()
      .default("RESIDENTIAL")
      .transform((value): CustomerType =>
        value === "COMMERCIAL" ? "COMMERCIAL" : "RESIDENTIAL"
      ),
    allowWeekendBooking: z
      .string()
      .optional()
      .transform((value) => value === "on"),
    direccionLinea1: textField(),
    direccionLinea2: textField(),
    ciudad: textField(),
    estadoProvincia: textField(),
    codigoPostal: textField(),
    notas: textField(),
  })
  .superRefine((data, ctx) => {
    const addressParts = [
      data.direccionLinea1,
      data.ciudad,
      data.estadoProvincia,
      data.codigoPostal,
    ];
    const hasAddress = addressParts.some(Boolean);
    const isComplete = addressParts.every(Boolean);
    if (hasAddress && !isComplete) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["direccionLinea1"],
        message: CUSTOMER_DETAIL_ERRORS.addressIncomplete,
      });
    }
  });

export const inviteCustomerSchema = z.object({ customerId: hiddenId() });

export const deleteCustomerSchema = z
  .object({
    customerId: hiddenId(),
    confirmDelete: z.string().default("no"),
    typedConfirmation: textField().transform((value) => value.toLowerCase()),
  })
  .superRefine((data, ctx) => {
    if (
      data.confirmDelete !== "yes" ||
      !DELETE_CONFIRMATION_WORDS.includes(data.typedConfirmation)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: CUSTOMER_DETAIL_ERRORS.confirmationMismatch,
      });
    }
  });

export const deletePropertySchema = z.object({
  propertyId: hiddenId(),
  customerId: hiddenId(),
  confirmDelete: z
    .string()
    .default("no")
    .refine((value) => value === "yes", CUSTOMER_DETAIL_ERRORS.invalidInput),
});

export const createJobSchema = z.object({
  customerId: hiddenId(),
  propertyId: requiredText(CUSTOMER_DETAIL_ERRORS.propertyRequired),
  technicianId: textField(),
  type: z
    .string()
    .default("ROUTINE")
    .transform((value): JobType => (value === "ON_DEMAND" ? "ON_DEMAND" : "ROUTINE")),
  priority: z
    .string()
    .default("NORMAL")
    .transform((value): JobPriority => (value === "URGENT" ? "URGENT" : "NORMAL")),
  serviceType: z
    .string()
    .default("WEEKLY_CLEANING")
    .transform(
      (value): ServiceType =>
        EXPLICIT_SERVICE_TYPES.find((option) => option === value) ?? "WEEKLY_CLEANING"
    ),
  serviceTierId: textField(),
  estimatedDuration: optionalNonNegativeInt(CUSTOMER_DETAIL_ERRORS.durationInvalid),
  notes: textField(),
  scheduledDate: requiredText(CUSTOMER_DETAIL_ERRORS.dateRequired),
  scheduledTime: textField().transform((value) => value || DEFAULT_JOB_TIME),
});

export const createServicePlanSchema = z.object({
  customerId: hiddenId(),
  propertyId: requiredText(CUSTOMER_DETAIL_ERRORS.propertyRequired),
  planTemplate: z.string().default(GLOBAL_RECURRING_PLAN_OPTIONS[0].value),
  technicianId: requiredText(CUSTOMER_DETAIL_ERRORS.technicianRequired),
  serviceTierId: textField(),
  nextDate: requiredText(CUSTOMER_DETAIL_ERRORS.dateRequired),
  estimatedDuration: optionalNonNegativeInt(CUSTOMER_DETAIL_ERRORS.durationInvalid),
  notes: textField(),
});

export const toggleServicePlanSchema = z.object({
  planId: hiddenId(),
  customerId: hiddenId(),
  isActive: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
});

export const deleteServicePlanSchema = z.object({
  planId: hiddenId(),
  customerId: hiddenId(),
});
