/**
 * Tests de src/lib/jobs/reschedule-status.ts (función pura).
 *
 * La regla se expresa en DÍAS DE NEGOCIO, así que las fechas se eligen para
 * cubrir los dos casos en que el día UTC y el de negocio no coinciden
 * (América/Nueva York, UTC-4 en septiembre).
 */
import { describe, expect, it, vi } from "vitest";
import type { JobStatus } from "@prisma/client";

// El módulo de zona horaria lee el entorno en tiempo de import.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

import { resolveRescheduledStatus } from "@/lib/jobs/reschedule-status";

/** 2026-09-21 09:00 en Nueva York. */
const MONDAY_MORNING = new Date("2026-09-21T13:00:00.000Z");
/** 2026-09-21 16:00 en Nueva York: mismo día de negocio. */
const MONDAY_AFTERNOON = new Date("2026-09-21T20:00:00.000Z");
/** 2026-09-21 21:00 en Nueva York: mismo día de negocio, día UTC distinto. */
const MONDAY_NIGHT = new Date("2026-09-22T01:00:00.000Z");
/** 2026-09-20 23:00 en Nueva York: día de negocio anterior, mismo día UTC. */
const SUNDAY_NIGHT = new Date("2026-09-21T03:00:00.000Z");
const WEDNESDAY = new Date("2026-09-23T13:00:00.000Z");
const PREVIOUS_SATURDAY = new Date("2026-09-19T13:00:00.000Z");
/** Fin del día de negocio del lunes 2026-09-21. */
const END_OF_MONDAY = new Date("2026-09-22T03:59:59.999Z");

function resolve(
  currentStatus: JobStatus,
  currentScheduledDate: Date,
  nextScheduledDate: Date
) {
  return resolveRescheduledStatus({
    currentStatus,
    currentScheduledDate,
    nextScheduledDate,
    endOfToday: END_OF_MONDAY,
  });
}

describe("resolveRescheduledStatus: sin cambio de día de negocio", () => {
  it("conserva ON_THE_WAY al reordenar dentro del mismo día", () => {
    expect(resolve("ON_THE_WAY", MONDAY_MORNING, MONDAY_AFTERNOON)).toBe("ON_THE_WAY");
  });

  it("conserva IN_PROGRESS al reordenar dentro del mismo día", () => {
    expect(resolve("IN_PROGRESS", MONDAY_MORNING, MONDAY_AFTERNOON)).toBe("IN_PROGRESS");
  });

  it("conserva el estado cuando la fecha no cambia en absoluto", () => {
    expect(resolve("ON_THE_WAY", MONDAY_MORNING, MONDAY_MORNING)).toBe("ON_THE_WAY");
    expect(resolve("PENDING", MONDAY_MORNING, MONDAY_MORNING)).toBe("PENDING");
    expect(resolve("SCHEDULED", MONDAY_MORNING, MONDAY_MORNING)).toBe("SCHEDULED");
  });

  it("conserva el estado aunque cambie el día UTC pero no el de negocio", () => {
    expect(resolve("IN_PROGRESS", MONDAY_MORNING, MONDAY_NIGHT)).toBe("IN_PROGRESS");
  });

  // Antes de la corrección, cualquier movimiento recalculaba el estado: un
  // trabajo de hoy que solo cambia de hora acababa siempre en PENDING.
  it("conserva SCHEDULED en un trabajo de hoy que solo cambia de hora", () => {
    expect(resolve("SCHEDULED", MONDAY_MORNING, MONDAY_AFTERNOON)).toBe("SCHEDULED");
  });
});

describe("resolveRescheduledStatus: con cambio de día de negocio", () => {
  it("pasa a SCHEDULED cuando la nueva fecha es posterior a hoy", () => {
    expect(resolve("ON_THE_WAY", MONDAY_MORNING, WEDNESDAY)).toBe("SCHEDULED");
    expect(resolve("PENDING", MONDAY_MORNING, WEDNESDAY)).toBe("SCHEDULED");
  });

  it("pasa a PENDING cuando la nueva fecha es hoy o anterior", () => {
    expect(resolve("SCHEDULED", MONDAY_MORNING, PREVIOUS_SATURDAY)).toBe("PENDING");
    expect(resolve("SCHEDULED", PREVIOUS_SATURDAY, MONDAY_MORNING)).toBe("PENDING");
  });

  it("detecta el cambio de día aunque el día UTC sea el mismo", () => {
    expect(resolve("IN_PROGRESS", MONDAY_MORNING, SUNDAY_NIGHT)).toBe("PENDING");
  });
});

describe("resolveRescheduledStatus: COMPLETED", () => {
  it("nunca se reabre, cambie o no el día", () => {
    expect(resolve("COMPLETED", MONDAY_MORNING, MONDAY_AFTERNOON)).toBe("COMPLETED");
    expect(resolve("COMPLETED", MONDAY_MORNING, WEDNESDAY)).toBe("COMPLETED");
    expect(resolve("COMPLETED", MONDAY_MORNING, PREVIOUS_SATURDAY)).toBe("COMPLETED");
  });
});
