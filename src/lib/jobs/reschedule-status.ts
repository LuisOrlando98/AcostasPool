import type { JobStatus } from "@prisma/client";
import { toDateKey } from "@/lib/jobs/capacity";

export type ResolveRescheduledStatusInput = {
  /** Estado actual del trabajo en la base de datos. */
  readonly currentStatus: JobStatus;
  readonly currentScheduledDate: Date;
  /** Fecha que queda tras aplicar el cambio (la actual si no se reprograma). */
  readonly nextScheduledDate: Date;
  /** Fin del día de negocio de hoy: separa "futuro" de "hoy o pasado". */
  readonly endOfToday: Date;
};

/**
 * Estado que le corresponde a un trabajo tras moverlo.
 *
 * Reordenar dentro del mismo día (o cambiar de técnico sin tocar la fecha) NO
 * es una reprogramación: un trabajo `ON_THE_WAY` o `IN_PROGRESS` conserva su
 * estado y el técnico no pierde el avance. Solo cuando cambia el día de negocio
 * se recalcula: al futuro queda `SCHEDULED` y a hoy o al pasado `PENDING`.
 * `COMPLETED` nunca se reabre.
 */
export function resolveRescheduledStatus({
  currentStatus,
  currentScheduledDate,
  nextScheduledDate,
  endOfToday,
}: ResolveRescheduledStatusInput): JobStatus {
  if (currentStatus === "COMPLETED") {
    return "COMPLETED";
  }
  if (toDateKey(currentScheduledDate) === toDateKey(nextScheduledDate)) {
    return currentStatus;
  }
  return nextScheduledDate > endOfToday ? "SCHEDULED" : "PENDING";
}
