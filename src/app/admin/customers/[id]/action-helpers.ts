import { redirect } from "next/navigation";
import {
  withActionErrorParam,
  type ActionResult,
} from "@/components/customers/forms/action-result";
import { prisma } from "@/lib/db";
import { getTranslations } from "@/i18n/server";
import { withFeedbackParam } from "@/lib/ui/action-feedback";

/**
 * Rutas, revalidaciones y utilidades que comparten las server actions de la
 * ficha de cliente (`actions.ts` y `finance-actions.ts`). Vive aparte porque un
 * módulo `"use server"` solo puede exportar funciones asíncronas.
 */

export const CUSTOMERS_LIST_PATH = "/admin/customers";
export const ASSIGNMENTS_PATH = "/admin/customers/assignments";
export const ROUTES_PATH = "/admin/routes";
export const INVOICES_PATH = "/admin/invoices";
export const ACCOUNTING_PATH = "/admin/accounting";
/** Estados de membresía que cuentan como activa para el arranque de servicio. */
export const LIVE_MEMBERSHIP_STATUSES = ["ACTIVE", "PAST_DUE"] as const;

export function customerDetailPath(customerId: string) {
  return `${CUSTOMERS_LIST_PATH}/${customerId}`;
}

export function customerDetailFeedbackPath(customerId: string, feedback: string) {
  return withFeedbackParam(customerDetailPath(customerId), feedback);
}

/**
 * Los fallos de contrato (PDF, firma, envío) llevan el mensaje real del error
 * en `contractError` para que el toast de la ficha lo muestre tal cual: son
 * fallos de integración (Playwright, almacenamiento, SMTP) y el admin necesita
 * el detalle, no un mensaje genérico.
 */
export const CONTRACT_ERROR_PARAM = "contractError";

export function customerDetailErrorPath(
  customerId: string,
  feedback: string,
  errorMessage: string
) {
  const base = customerDetailFeedbackPath(customerId, feedback);
  const [pathname, queryString = ""] = base.split("?", 2);
  const params = new URLSearchParams(queryString);
  params.set(CONTRACT_ERROR_PARAM, errorMessage);
  return `${pathname}?${params.toString()}`;
}

export function errorMessageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Traduce el error de un `ActionResult` al idioma de la petición, para las
 * acciones que invoca el cliente y muestran el mensaje tal cual.
 */
export async function translatedError(result: ActionResult) {
  if (result.ok) {
    return undefined;
  }
  const t = await getTranslations();
  return { error: t(result.error) };
}

/** Propiedad del cliente (dirección incluida) o null si no existe o es de otro cliente. */
export async function findCustomerProperty(propertyId: string, customerId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { customerId: true, address: true },
  });
  return property && property.customerId === customerId ? property : null;
}

/**
 * AdminCustomerProperties, CustomerPlansTable y DeleteCustomerButton no
 * usan useActionState todavía: en caso de error se redirige a la ficha con
 * `?feedback=action-error&error=<nombre>` y la página lo muestra en un toast.
 */
export function redirectOnFailure(result: ActionResult, formData: FormData): void {
  if (result.ok) {
    return;
  }
  const customerId = String(formData.get("customerId") ?? "").trim();
  const basePath = customerId ? customerDetailPath(customerId) : CUSTOMERS_LIST_PATH;
  redirect(withActionErrorParam(basePath, result.error));
}
