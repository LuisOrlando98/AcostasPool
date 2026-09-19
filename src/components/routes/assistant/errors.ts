/**
 * Traducción de los errores de los endpoints del asistente: el `code` decide
 * el mensaje que lee el administrador y el `error` del servidor se conserva
 * como detalle entre paréntesis, para no perder información al diagnosticar.
 */

import type { AssistantErrorCode } from "@/lib/routing/assistant-types";
import { AssistantRequestError } from "./api";
import { ASSISTANT_I18N_PREFIX } from "./labels";
import type { TranslateFn } from "./types";

const ERROR_CODE_KEYS: Readonly<Record<AssistantErrorCode, string>> = {
  TOO_MANY_JOBS: `${ASSISTANT_I18N_PREFIX}.errors.tooManyJobs`,
  RATE_LIMITED: `${ASSISTANT_I18N_PREFIX}.errors.rateLimited`,
  JOB_NOT_FOUND: `${ASSISTANT_I18N_PREFIX}.errors.jobNotFound`,
  PROPERTY_NOT_FOUND: `${ASSISTANT_I18N_PREFIX}.errors.propertyNotFound`,
};

export function assistantErrorCodeKey(code: AssistantErrorCode): string {
  return ERROR_CODE_KEYS[code];
}

/**
 * Mensaje para la interfaz. Sin `code` conocido se usa el texto del servidor
 * (o el de respaldo); con `code`, el texto traducido más el detalle si aporta
 * algo distinto.
 */
export function describeAssistantError(
  error: unknown,
  t: TranslateFn,
  fallback: string
): string {
  if (!(error instanceof AssistantRequestError) || !error.code) {
    return error instanceof Error && error.message ? error.message : fallback;
  }
  const message = t(assistantErrorCodeKey(error.code), {
    limit: error.limit ?? 0,
  });
  if (!error.detail || error.detail === message) {
    return message;
  }
  return t(`${ASSISTANT_I18N_PREFIX}.errors.withDetail`, {
    message,
    detail: error.detail,
  });
}
