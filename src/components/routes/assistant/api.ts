/**
 * Llamadas del asistente a sus endpoints. Toda respuesta se valida antes de
 * usarse: un cuerpo inesperado se convierte en error con el mensaje del
 * servidor si lo trae, o con el texto de respaldo que pasa el llamante.
 */

import type {
  AssistantErrorCode,
  AssistantPlanResponse,
  AssistantRecalculateRequest,
  AssistantRecalculateResponse,
} from "@/lib/routing/assistant-types";
import type {
  AssistantPlanRequest,
  BulkRescheduleResult,
  RouteAssistantSettings,
} from "./types";

export const PLAN_ENDPOINT = "/api/admin/routes/assistant/plan";
export const RECALCULATE_ENDPOINT = "/api/admin/routes/assistant/recalculate";
export const SETTINGS_ENDPOINT = "/api/admin/routes/assistant/settings";
export const BULK_RESCHEDULE_ENDPOINT = "/api/routes/bulk-reschedule";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

const ERROR_CODES: readonly AssistantErrorCode[] = [
  "TOO_MANY_JOBS",
  "RATE_LIMITED",
  "JOB_NOT_FOUND",
];

/**
 * Error de un endpoint del asistente con su `code` cuando lo trae: la interfaz
 * traduce el código y deja el texto del servidor como detalle.
 */
export class AssistantRequestError extends Error {
  readonly code: AssistantErrorCode | null;
  readonly limit: number | null;
  readonly detail: string | null;

  constructor(
    message: string,
    options: {
      readonly code?: AssistantErrorCode | null;
      readonly limit?: number | null;
      readonly detail?: string | null;
    } = {}
  ) {
    super(message);
    this.name = "AssistantRequestError";
    this.code = options.code ?? null;
    this.limit = options.limit ?? null;
    this.detail = options.detail ?? null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readServerError(payload: unknown): string | null {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error) {
    return payload.error;
  }
  return null;
}

function readErrorCode(payload: unknown): AssistantErrorCode | null {
  if (!isRecord(payload) || typeof payload.code !== "string") {
    return null;
  }
  return ERROR_CODES.find((candidate) => candidate === payload.code) ?? null;
}

function toRequestError(payload: unknown, fallback: string): AssistantRequestError {
  const detail = readServerError(payload);
  const limit =
    isRecord(payload) && typeof payload.limit === "number" ? payload.limit : null;
  return new AssistantRequestError(detail ?? fallback, {
    code: readErrorCode(payload),
    limit,
    detail,
  });
}

/**
 * POST con cuerpo JSON. `isValid` decide si la respuesta 200 tiene la forma
 * esperada; si no, se lanza `fallbackError` en lugar de propagar datos rotos.
 */
async function postJson<T>(
  url: string,
  body: unknown,
  fallbackError: string,
  isValid: (payload: unknown) => payload is T,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw toRequestError(payload, fallbackError);
  }
  if (!isValid(payload)) {
    throw new AssistantRequestError(fallbackError);
  }
  return payload;
}

const isPlanResponse = (payload: unknown): payload is AssistantPlanResponse =>
  isRecord(payload) && Array.isArray(payload.plans) && typeof payload.date === "string";

const isRecalculateResponse = (
  payload: unknown
): payload is AssistantRecalculateResponse =>
  isRecord(payload) && isRecord(payload.plan) && Array.isArray(payload.plan.routes);

const isBulkRescheduleResult = (payload: unknown): payload is BulkRescheduleResult =>
  isRecord(payload) &&
  Array.isArray(payload.applied) &&
  Array.isArray(payload.skipped) &&
  Array.isArray(payload.failed);

const isSettingsResponse = (
  payload: unknown
): payload is { readonly ok: boolean; readonly config: RouteAssistantSettings } =>
  isRecord(payload) && isRecord(payload.config);

export function requestPlan(
  body: AssistantPlanRequest,
  fallbackError: string,
  signal?: AbortSignal
): Promise<AssistantPlanResponse> {
  return postJson(PLAN_ENDPOINT, body, fallbackError, isPlanResponse, signal);
}

export function requestRecalculation(
  body: AssistantRecalculateRequest,
  fallbackError: string,
  signal?: AbortSignal
): Promise<AssistantRecalculateResponse> {
  return postJson(
    RECALCULATE_ENDPOINT,
    body,
    fallbackError,
    isRecalculateResponse,
    signal
  );
}

/**
 * `bulk-reschedule` responde 500 con el detalle de los fallos cuando algún
 * elemento no se pudo aplicar: ese cuerpo es un resultado válido, no un error,
 * y la UI lo muestra con los aplicados y omitidos.
 */
export async function requestBulkReschedule(
  updates: readonly { readonly jobId: string; readonly technicianId: string; readonly sortOrder: number }[],
  fallbackError: string
): Promise<BulkRescheduleResult> {
  const response = await fetch(BULK_RESCHEDULE_ENDPOINT, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ updates }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (isBulkRescheduleResult(payload)) {
    return payload;
  }
  throw toRequestError(payload, fallbackError);
}

export function requestSettingsUpdate(
  body: Partial<RouteAssistantSettings>,
  fallbackError: string
): Promise<{ readonly ok: boolean; readonly config: RouteAssistantSettings }> {
  return postJson(SETTINGS_ENDPOINT, body, fallbackError, isSettingsResponse);
}
