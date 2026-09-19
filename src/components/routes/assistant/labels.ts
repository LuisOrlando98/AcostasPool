/**
 * Traducción de los valores del dominio a claves de i18n y lectura de las
 * etiquetas opacas del borrador (`"move:<jobId>"`). Puro: se prueba en
 * `tests/unit/components/routes-assistant/labels.test.ts`.
 */

import type {
  AssistantDriveSource,
  AssistantJobStatus,
} from "@/lib/routing/assistant-types";

export const ASSISTANT_I18N_PREFIX = "admin.routes.assistant";

const JOB_STATUS_KEYS: Readonly<Record<AssistantJobStatus, string>> = {
  SCHEDULED: "jobs.status.scheduled",
  PENDING: "jobs.status.pending",
  ON_THE_WAY: "jobs.status.onTheWay",
  IN_PROGRESS: "jobs.status.inProgress",
};

const DRIVE_SOURCE_KEYS: Readonly<Record<AssistantDriveSource, string>> = {
  LIVE_TRAFFIC: `${ASSISTANT_I18N_PREFIX}.table.liveTraffic`,
  ESTIMATED: `${ASSISTANT_I18N_PREFIX}.table.estimated`,
  SAME_ADDRESS: `${ASSISTANT_I18N_PREFIX}.table.sameAddress`,
};

const DRIVE_SOURCE_TONES: Readonly<Record<AssistantDriveSource, ChipTone>> = {
  LIVE_TRAFFIC: "success",
  ESTIMATED: "neutral",
  SAME_ADDRESS: "info",
};

const UNDO_KINDS = ["move", "reassign", "remove", "restore"] as const;

export type UndoKind = (typeof UNDO_KINDS)[number];
export type ChipTone = "neutral" | "info" | "success" | "warning" | "danger";

export function jobStatusKey(status: AssistantJobStatus): string {
  return JOB_STATUS_KEYS[status];
}

export function driveSourceKey(source: AssistantDriveSource | undefined): string | null {
  return source ? DRIVE_SOURCE_KEYS[source] : null;
}

export function driveSourceTone(source: AssistantDriveSource | undefined): ChipTone {
  return source ? DRIVE_SOURCE_TONES[source] : "neutral";
}

/** Los estados en los que el trabajo ya está en marcha se resaltan. */
export function jobStatusTone(status: AssistantJobStatus): ChipTone {
  return status === "ON_THE_WAY" || status === "IN_PROGRESS" ? "warning" : "neutral";
}

/**
 * `lastUndoLabel(draft)` devuelve `"<kind>:<jobId>"`; aquí se extrae el tipo
 * para traducirlo. Un valor desconocido devuelve `null` (la UI usa el texto
 * genérico de "Deshacer").
 */
export function parseUndoKind(label: string | null): UndoKind | null {
  if (!label) {
    return null;
  }
  const [kind] = label.split(":", 1);
  return UNDO_KINDS.find((candidate) => candidate === kind) ?? null;
}

export function undoKindKey(kind: UndoKind): string {
  return `${ASSISTANT_I18N_PREFIX}.undo.${kind}`;
}
