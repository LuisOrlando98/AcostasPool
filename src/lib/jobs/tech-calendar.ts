import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import { addPlanFrequency } from "@/lib/jobs/scheduling";

/**
 * Cálculos puros del calendario mensual del técnico (`/tech/calendar`).
 *
 * Todo se expresa en la zona horaria del negocio: las claves de día
 * (`yyyy-MM-dd`) y de mes (`yyyy-MM`) salen de ella, y la cuadrícula empieza
 * en lunes. Aquí no hay acceso a base de datos: la página carga trabajos y
 * planes y este módulo los coloca en días.
 */

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAYS_PER_WEEK = 7;
/** Tope de saltos al avanzar un plan hasta el inicio del rango (5 años semanales). */
const MAX_SKIPPED_OCCURRENCES = 260;
/** Tope de ocurrencias emitidas por plan dentro del rango. */
const MAX_EMITTED_OCCURRENCES = 320;

export type MonthRef = {
  readonly year: number;
  readonly month: number;
};

export type CalendarCell = {
  readonly dateKey: string;
  readonly dayOfMonth: number;
  readonly inMonth: boolean;
};

export type PlanLike = {
  readonly id: string;
  readonly nextRunAt: Date;
  readonly frequency: string;
};

export type PlanOccurrence<TPlan extends PlanLike> = {
  readonly plan: TPlan;
  readonly scheduledDate: Date;
  readonly dateKey: string;
};

function businessDate(value: Date): DateTime {
  return DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE);
}

function monthStart(ref: MonthRef): DateTime {
  return DateTime.fromObject(
    { year: ref.year, month: ref.month, day: 1 },
    { zone: BUSINESS_TIMEZONE }
  );
}

/** `yyyy-MM-dd` del instante en la zona horaria del negocio. */
export function toBusinessDateKey(value: Date): string {
  return businessDate(value).toFormat("yyyy-MM-dd");
}

/** `yyyy-MM` o `null` si el valor no tiene esa forma. */
export function parseMonthKey(value: string | null | undefined): MonthRef | null {
  const match = value?.trim().match(MONTH_KEY_PATTERN);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function formatMonthKey(ref: MonthRef): string {
  return monthStart(ref).toFormat("yyyy-MM");
}

export function isDateKey(value: string | null | undefined): value is string {
  return typeof value === "string" && DATE_KEY_PATTERN.test(value);
}

/** Mes en curso en la zona horaria del negocio. */
export function getCurrentMonth(now: Date = new Date()): MonthRef {
  const current = businessDate(now);
  return { year: current.year, month: current.month };
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const shifted = monthStart(ref).plus({ months: delta });
  return { year: shifted.year, month: shifted.month };
}

/**
 * Instantes (UTC) que delimitan la cuadrícula del mes: desde el lunes de la
 * semana del día 1 hasta el final del domingo de la semana del último día.
 */
export function getMonthGridRange(ref: MonthRef): { readonly start: Date; readonly end: Date } {
  const first = monthStart(ref);
  const gridStart = first.startOf("week");
  const gridEnd = first.endOf("month").endOf("week");
  return { start: gridStart.toUTC().toJSDate(), end: gridEnd.toUTC().toJSDate() };
}

/** Semanas (filas de 7 celdas, de lunes a domingo) que cubren el mes. */
export function buildMonthGrid(ref: MonthRef): CalendarCell[][] {
  const first = monthStart(ref);
  const gridStart = first.startOf("week");
  // Último día de la cuadrícula a las 00:00 para contar días completos.
  const lastDay = first.endOf("month").endOf("week").startOf("day");
  const totalDays = Math.round(lastDay.diff(gridStart, "days").days) + 1;
  const weeks: CalendarCell[][] = [];

  for (let offset = 0; offset < totalDays; offset += DAYS_PER_WEEK) {
    const week = Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
      const day = gridStart.plus({ days: offset + index });
      return {
        dateKey: day.toFormat("yyyy-MM-dd"),
        dayOfMonth: day.day,
        inMonth: day.month === ref.month && day.year === ref.year,
      };
    });
    weeks.push(week);
  }
  return weeks;
}

/**
 * Día seleccionado: el pedido si pertenece al mes mostrado; si no, hoy cuando
 * cae en ese mes; en último término, el día 1.
 */
export function resolveSelectedDay(
  requested: string | null | undefined,
  ref: MonthRef,
  todayKey: string
): string {
  const monthKey = formatMonthKey(ref);
  if (isDateKey(requested) && requested.startsWith(`${monthKey}-`)) {
    return requested;
  }
  if (todayKey.startsWith(`${monthKey}-`)) {
    return todayKey;
  }
  return `${monthKey}-01`;
}

/** Clave que identifica la visita de un plan en un día concreto. */
export function planOccurrenceKey(planId: string, scheduledDate: Date): string {
  return `${planId}:${toBusinessDateKey(scheduledDate)}`;
}

/**
 * Visitas futuras de planes recurrentes que aún no existen como trabajo
 * (mismo criterio que el calendario de administración): se avanza desde
 * `nextRunAt` según la frecuencia hasta entrar en el rango y se emite cada
 * ocurrencia dentro de él cuya clave no esté en `existingKeys`.
 */
export function projectPlanOccurrences<TPlan extends PlanLike>(
  plans: readonly TPlan[],
  options: {
    readonly rangeStart: Date;
    readonly rangeEnd: Date;
    readonly existingKeys: ReadonlySet<string>;
  }
): PlanOccurrence<TPlan>[] {
  const rangeStart = businessDate(options.rangeStart);
  const rangeEnd = businessDate(options.rangeEnd);

  return plans.flatMap((plan) => {
    const occurrences: PlanOccurrence<TPlan>[] = [];
    let occurrence = businessDate(plan.nextRunAt);
    let guard = 0;

    while (occurrence < rangeStart && guard < MAX_SKIPPED_OCCURRENCES) {
      occurrence = businessDate(addPlanFrequency(occurrence.toUTC().toJSDate(), plan.frequency));
      guard += 1;
    }

    while (occurrence <= rangeEnd && guard < MAX_EMITTED_OCCURRENCES) {
      const scheduledDate = occurrence.toUTC().toJSDate();
      const key = planOccurrenceKey(plan.id, scheduledDate);
      if (!options.existingKeys.has(key)) {
        occurrences.push({ plan, scheduledDate, dateKey: toBusinessDateKey(scheduledDate) });
      }
      occurrence = businessDate(addPlanFrequency(scheduledDate, plan.frequency));
      guard += 1;
    }

    return occurrences;
  });
}
