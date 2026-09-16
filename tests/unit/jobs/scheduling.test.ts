import { afterAll, describe, expect, it, vi } from "vitest";
import { addPlanFrequency, combineDateAndTime } from "@/lib/jobs/scheduling";

// El módulo de zona horaria lee el entorno en tiempo de import.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

const DAYS_PER_WEEK = 7;
const DAYS_PER_TWO_WEEKS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Frecuencias del enum PlanFrequency de Prisma. */
const PLAN_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

/** 2026-03-08: salto de 02:00 EST a 03:00 EDT. */
const SPRING_FORWARD_DAY = "2026-03-08";
/** 2026-11-01: retroceso de 02:00 EDT a 01:00 EST. */
const FALL_BACK_DAY = "2026-11-01";

const iso = (value: Date) => value.toISOString();

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("combineDateAndTime", () => {
  it("combina fecha y hora en la zona de negocio (verano e invierno)", () => {
    expect(iso(combineDateAndTime("2026-06-15", "09:30"))).toBe("2026-06-15T13:30:00.000Z");
    expect(iso(combineDateAndTime("2026-01-15", "09:30"))).toBe("2026-01-15T14:30:00.000Z");
  });

  it("acepta horas de un solo dígito y las rellena con cero", () => {
    expect(iso(combineDateAndTime("2026-06-15", "9:30"))).toBe("2026-06-15T13:30:00.000Z");
    expect(iso(combineDateAndTime("2026-06-15", "0:05"))).toBe("2026-06-15T04:05:00.000Z");
  });

  it("desplaza hacia delante una hora inexistente en el salto de marzo", () => {
    expect(iso(combineDateAndTime(SPRING_FORWARD_DAY, "02:30"))).toBe(
      "2026-03-08T07:30:00.000Z"
    );
  });

  it("resuelve la hora ambigua de noviembre con la primera ocurrencia (EDT)", () => {
    expect(iso(combineDateAndTime(FALL_BACK_DAY, "01:30"))).toBe("2026-11-01T05:30:00.000Z");
    expect(iso(combineDateAndTime(FALL_BACK_DAY, "09:00"))).toBe("2026-11-01T14:00:00.000Z");
  });

  it("devuelve Invalid Date cuando la hora no cumple H:mm o HH:mm", () => {
    for (const time of ["9:5", "", "09:30:00", "0930", "ab:cd", " 09:30", "09:30 "]) {
      expect(Number.isNaN(combineDateAndTime("2026-06-15", time).getTime())).toBe(true);
    }
  });

  it("devuelve Invalid Date cuando la hora está fuera de rango", () => {
    expect(Number.isNaN(combineDateAndTime("2026-06-15", "25:00").getTime())).toBe(true);
    expect(Number.isNaN(combineDateAndTime("2026-06-15", "23:60").getTime())).toBe(true);
    expect(Number.isNaN(combineDateAndTime("2026-06-15", "99:99").getTime())).toBe(true);
  });

  it("devuelve Invalid Date cuando la fecha es inexistente o no es yyyy-MM-dd estricto", () => {
    for (const date of ["2026-02-30", "2026-13-01", "2026-6-15", "15/06/2026", ""]) {
      expect(Number.isNaN(combineDateAndTime(date, "09:00").getTime())).toBe(true);
    }
  });

  it("acepta 24:00 y lo convierte en la medianoche del día siguiente (comportamiento actual)", () => {
    expect(iso(combineDateAndTime("2026-06-15", "24:00"))).toBe("2026-06-16T04:00:00.000Z");
  });

  it.fails("debería rechazar 24:00 igual que rechaza 25:00 (bug sospechado)", () => {
    expect(Number.isNaN(combineDateAndTime("2026-06-15", "24:00").getTime())).toBe(true);
  });
});

describe("addPlanFrequency", () => {
  it("WEEKLY suma 7 días manteniendo el instante en verano", () => {
    const start = new Date("2026-06-15T13:00:00Z");

    const result = addPlanFrequency(start, "WEEKLY");

    expect(iso(result)).toBe("2026-06-22T13:00:00.000Z");
    expect(result.getTime() - start.getTime()).toBe(DAYS_PER_WEEK * MS_PER_DAY);
  });

  it("BIWEEKLY suma 14 días", () => {
    const start = new Date("2026-06-15T13:00:00Z");

    const result = addPlanFrequency(start, "BIWEEKLY");

    expect(iso(result)).toBe("2026-06-29T13:00:00.000Z");
    expect(result.getTime() - start.getTime()).toBe(DAYS_PER_TWO_WEEKS * MS_PER_DAY);
  });

  it("MONTHLY conserva el día del mes cuando existe", () => {
    expect(iso(addPlanFrequency(new Date("2026-06-15T13:00:00Z"), "MONTHLY"))).toBe(
      "2026-07-15T13:00:00.000Z"
    );
  });

  it("MONTHLY recorta al último día cuando el mes siguiente es más corto", () => {
    expect(iso(addPlanFrequency(new Date("2026-01-31T14:00:00Z"), "MONTHLY"))).toBe(
      "2026-02-28T14:00:00.000Z"
    );
    expect(iso(addPlanFrequency(new Date("2024-01-31T14:00:00Z"), "MONTHLY"))).toBe(
      "2024-02-29T14:00:00.000Z"
    );
    expect(iso(addPlanFrequency(new Date("2026-03-31T13:00:00Z"), "MONTHLY"))).toBe(
      "2026-04-30T13:00:00.000Z"
    );
  });

  it("mantiene la hora de pared (09:00 Nueva York) al cruzar el salto de marzo", () => {
    // 09:00 EST del jueves 5 -> 09:00 EDT del jueves 12 (6 días y 23 h después).
    const start = new Date("2026-03-05T14:00:00Z");

    const result = addPlanFrequency(start, "WEEKLY");

    expect(iso(result)).toBe("2026-03-12T13:00:00.000Z");
    expect(result.getTime() - start.getTime()).toBe(DAYS_PER_WEEK * MS_PER_DAY - 60 * 60 * 1000);
  });

  it("mantiene la hora de pared al cruzar el retroceso de noviembre", () => {
    // 09:00 EDT del jueves 29 -> 09:00 EST del jueves 5.
    expect(iso(addPlanFrequency(new Date("2026-10-29T13:00:00Z"), "WEEKLY"))).toBe(
      "2026-11-05T14:00:00.000Z"
    );
    expect(iso(addPlanFrequency(new Date("2026-10-01T13:00:00Z"), "MONTHLY"))).toBe(
      "2026-11-01T14:00:00.000Z"
    );
  });

  it("cualquier frecuencia desconocida (incluida minúscula o vacía) se trata como WEEKLY", () => {
    const start = new Date("2026-06-15T13:00:00Z");
    const weekly = iso(addPlanFrequency(start, "WEEKLY"));

    expect(iso(addPlanFrequency(start, "monthly"))).toBe(weekly);
    expect(iso(addPlanFrequency(start, "DAILY"))).toBe(weekly);
    expect(iso(addPlanFrequency(start, ""))).toBe(weekly);
  });

  it("no muta la fecha de entrada y devuelve un objeto nuevo para cada frecuencia", () => {
    const start = new Date("2026-06-15T13:00:00Z");
    const originalTime = start.getTime();

    for (const frequency of PLAN_FREQUENCIES) {
      const result = addPlanFrequency(start, frequency);
      expect(result).not.toBe(start);
    }

    expect(start.getTime()).toBe(originalTime);
  });

  it("propaga una Date inválida como Invalid Date", () => {
    for (const frequency of PLAN_FREQUENCIES) {
      expect(Number.isNaN(addPlanFrequency(new Date(Number.NaN), frequency).getTime())).toBe(
        true
      );
    }
  });
});
