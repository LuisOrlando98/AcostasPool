/**
 * Contrato compartido entre las server actions de la ficha de cliente
 * (`src/app/admin/customers/[id]/actions.ts`) y los formularios cliente
 * que muestran sus errores. Los mensajes viajan como claves i18n y se
 * traducen en el cliente con `useI18n`.
 */

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ACTION_SUCCESS: ActionResult = { ok: true };

export function failure(
  error: string,
  fieldErrors?: Record<string, string>
): ActionResult {
  return fieldErrors && Object.keys(fieldErrors).length > 0
    ? { ok: false, error, fieldErrors }
    : { ok: false, error };
}

/** Estado que mantiene `useActionState`: null hasta el primer envío. */
export type ActionState = ActionResult | null;

export type CustomerDetailFormAction = (
  state: ActionState,
  formData: FormData
) => Promise<ActionResult>;

const ERROR_KEY_PREFIX = "admin.customers.detail.errors.";

const ERROR_NAMES = [
  "invalidInput",
  "customerNotFound",
  "propertyNotFound",
  "planNotFound",
  "emailInUse",
  "inviteFailed",
  "propertyHasJobs",
  "propertyHasPlans",
  "hasFinancialRecords",
  "confirmationMismatch",
  "firstNameRequired",
  "phoneInvalid",
  "secondaryPhoneInvalid",
  "addressIncomplete",
  "propertyAddressRequired",
  "accessNotesRequired",
  "poolVolumeInvalid",
  "paymentInfoInvalid",
  "propertyRequired",
  "dateRequired",
  "dateInvalid",
  "technicianRequired",
  "durationInvalid",
] as const;

export type CustomerDetailErrorName = (typeof ERROR_NAMES)[number];

/** Claves i18n completas de cada error, indexadas por su nombre corto. */
export const CUSTOMER_DETAIL_ERRORS = Object.fromEntries(
  ERROR_NAMES.map((name) => [name, `${ERROR_KEY_PREFIX}${name}`])
) as Record<CustomerDetailErrorName, string>;

const ERROR_NAME_BY_KEY = new Map<string, CustomerDetailErrorName>(
  ERROR_NAMES.map((name) => [CUSTOMER_DETAIL_ERRORS[name], name])
);

function isCustomerDetailErrorName(
  value: unknown
): value is CustomerDetailErrorName {
  return (
    typeof value === "string" &&
    (ERROR_NAMES as readonly string[]).includes(value)
  );
}

/**
 * Mensajes que ya existen en otras secciones de la ficha y que reutilizan las
 * acciones de contrato/membresía. No entran en ERROR_NAMES porque nunca viajan
 * por la URL con `?error=`: se muestran dentro del propio formulario o modal.
 */
export const CUSTOMER_DETAIL_INLINE_ERRORS = {
  planRequired: "admin.customers.detail.sendStart.errors.planRequired",
  sendFailed: "admin.customers.detail.sendStart.errors.generic",
  signatureRequired: "admin.customers.detail.contract.missingSignature",
  membershipFailed: "admin.customers.detail.membership.errors.generic",
  membershipFeeFailed: "admin.customers.detail.membership.errors.feeFailed",
} as const;

/**
 * Valor del parámetro `feedback` con el que las acciones invocadas desde
 * componentes que aún esperan `(formData) => Promise<void>` redirigen a la
 * ficha para mostrar el error en un toast.
 */
export const ACTION_ERROR_FEEDBACK = "action-error";
export const ACTION_ERROR_PARAM = "error";

export function withActionErrorParam(path: string, errorKey: string) {
  const [pathname, queryString = ""] = path.split("?", 2);
  const params = new URLSearchParams(queryString);
  const errorName = ERROR_NAME_BY_KEY.get(errorKey) ?? "invalidInput";
  params.set("feedback", ACTION_ERROR_FEEDBACK);
  params.set(ACTION_ERROR_PARAM, errorName);
  return `${pathname}?${params.toString()}`;
}

/** Clave i18n del error señalado en la URL, o null si no es un error conocido. */
export function resolveActionErrorKey(
  feedback: string | undefined,
  errorName: string | undefined
) {
  if (feedback !== ACTION_ERROR_FEEDBACK || !isCustomerDetailErrorName(errorName)) {
    return null;
  }
  return CUSTOMER_DETAIL_ERRORS[errorName];
}
