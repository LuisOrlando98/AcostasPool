/**
 * Helpers puros de presentación del asistente de rutas (sin React ni i18n):
 * se prueban en `tests/unit/components/routes-assistant/format.test.ts`.
 */

import { parseDateOnly, toDateKey } from "@/lib/jobs/capacity";
import type { Translator } from "@/i18n/core";
import type { AssistantStop } from "@/lib/routing/assistant-types";
import type { DraftDiff } from "@/lib/routing/draft";

/**
 * "3 cambios: 1 reordenado · 1 reasignado · 1 excluido", con cada cifra en
 * singular o plural según corresponda.
 */
export function formatChangesSummary(t: Translator, diff: DraftDiff): string {
  const parts = [
    t.plural("admin.routes.assistant.changes.reordered", diff.reordered),
    t.plural("admin.routes.assistant.changes.reassigned", diff.reassigned),
    t.plural("admin.routes.assistant.changes.removed", diff.removed),
  ];
  return `${t.plural("admin.routes.assistant.changes.total", diff.total)}: ${parts.join(" · ")}`;
}

const MINUTES_PER_HOUR = 60;
const DAYS_PER_WEEK = 7;
const MONTH_KEY_LENGTH = "YYYY-MM".length;
/** Estados en los que el técnico ya salió hacia la parada o la está haciendo. */
const ACTIVE_STOP_STATUSES: ReadonlySet<AssistantStop["status"]> = new Set([
  "ON_THE_WAY",
  "IN_PROGRESS",
]);

/** `95` -> `"1h 35m"`, `40` -> `"40m"`. Los negativos y decimales se normalizan. */
export function formatMinutes(minutes: number): string {
  const safe = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const hours = Math.floor(safe / MINUTES_PER_HOUR);
  const rest = safe % MINUTES_PER_HOUR;
  return hours === 0 ? `${rest}m` : `${hours}h ${String(rest).padStart(2, "0")}m`;
}

/**
 * `"12m (4.1 mi)"`, o `"12m"` sin distancia resuelta. Usa el mismo formato de
 * duración que el resto: un tramo largo en minutos sueltos ("182h" escrito
 * como "10939m") se confunde con metros.
 */
export function formatDrive(
  minutes: number,
  distanceMiles: number | null
): string {
  const duration = formatMinutes(minutes);
  return distanceMiles == null ? duration : `${duration} (${distanceMiles} mi)`;
}

/**
 * Adelanta `dateKey` al próximo día de la semana del plan elegido (hoy incluido).
 * Devuelve la fecha intacta si no es una fecha válida o no hay día de plan.
 */
export function alignDateToPlanWeekday(
  dateKey: string,
  weekday: number | null
): string {
  const parsed = weekday == null ? null : parseDateOnly(dateKey);
  if (!parsed || weekday == null) {
    return dateKey;
  }
  const offset = (weekday - parsed.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  if (offset === 0) {
    return dateKey;
  }
  const aligned = new Date(parsed);
  aligned.setUTCDate(aligned.getUTCDate() + offset);
  return toDateKey(aligned);
}

/** Enlace al calendario del mes de la ruta, resaltando el primer trabajo aplicado. */
export function buildCalendarHref(dateKey: string, jobId?: string): string {
  const month = dateKey.slice(0, MONTH_KEY_LENGTH);
  const params = new URLSearchParams({ month });
  if (jobId) {
    params.set("highlight", jobId);
  }
  return `/admin/routes?${params.toString()}`;
}

/** Paradas en camino o en progreso entre los trabajos que se van a tocar. */
export function countActiveStops(
  stops: readonly AssistantStop[],
  jobIds: readonly string[]
): number {
  const affected = new Set(jobIds);
  return stops.filter(
    (stop) => affected.has(stop.jobId) && ACTIVE_STOP_STATUSES.has(stop.status)
  ).length;
}

/** Cuenta por origen del tramo para los chips de la propuesta. */
export function countDriveSources(
  stops: readonly AssistantStop[]
): { readonly live: number; readonly estimated: number; readonly sameAddress: number } {
  return stops.reduce(
    (counts, stop) => ({
      live: counts.live + (stop.driveSource === "LIVE_TRAFFIC" ? 1 : 0),
      estimated: counts.estimated + (stop.driveSource === "ESTIMATED" ? 1 : 0),
      sameAddress: counts.sameAddress + (stop.driveSource === "SAME_ADDRESS" ? 1 : 0),
    }),
    { live: 0, estimated: 0, sameAddress: 0 }
  );
}
