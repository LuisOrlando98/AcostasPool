import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  BUSINESS_TIMEZONE,
  addBusinessDays,
  applyBusinessTime,
  endOfBusinessDay,
  formatBusinessDateInput,
  formatInBusinessTimeZone,
  getBusinessNow,
  getBusinessTimeParts,
  parseBusinessDateInput,
  parseBusinessDateTimeInput,
  startOfBusinessDay,
} from "@/lib/timezone";

// El módulo lee la zona en tiempo de import: se fija antes de cualquier import.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

const NEW_YORK_TIMEZONE = "America/New_York";
const MS_PER_HOUR = 60 * 60 * 1000;
const HOURS_IN_SHORT_DAY = 23;
const HOURS_IN_LONG_DAY = 25;

/** 2026-03-08: a las 02:00 EST el reloj salta a 03:00 EDT (día de 23 h). */
const SPRING_FORWARD_DAY = "2026-03-08";
const SPRING_FORWARD_NOON_UTC = "2026-03-08T12:00:00Z";
/** 2026-11-01: a las 02:00 EDT el reloj vuelve a 01:00 EST (día de 25 h). */
const FALL_BACK_DAY = "2026-11-01";
const FALL_BACK_NOON_UTC = "2026-11-01T12:00:00Z";

const iso = (value: Date | null) => value?.toISOString() ?? null;

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("BUSINESS_TIMEZONE", () => {
  it("es America/New_York en esta suite (todas las expectativas dependen de ello)", () => {
    expect(BUSINESS_TIMEZONE).toBe(NEW_YORK_TIMEZONE);
  });
});

describe("formatInBusinessTimeZone", () => {
  it("formatea usando el día civil de Nueva York, no el de UTC", () => {
    // 02:00Z del 15 de junio son las 22:00 EDT del 14 de junio.
    const result = formatInBusinessTimeZone("2026-06-15T02:00:00Z", "en-US", {
      dateStyle: "medium",
    });

    expect(result).toBe("Jun 14, 2026");
  });

  it("respeta el locale solicitado", () => {
    const result = formatInBusinessTimeZone("2026-06-15T02:00:00Z", "es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    expect(result).toBe("domingo, 14 de junio");
  });

  it("ignora un timeZone pasado en options y fuerza la zona de negocio", () => {
    const result = formatInBusinessTimeZone("2026-06-15T13:05:00Z", "en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    expect(result).toBe("09:05");
  });

  it("cambia de offset dentro del día del salto de marzo (EST -> EDT)", () => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };

    expect(formatInBusinessTimeZone("2026-03-08T06:30:00Z", "en-US", options)).toBe("01:30");
    expect(formatInBusinessTimeZone("2026-03-08T07:30:00Z", "en-US", options)).toBe("03:30");
  });

  it("muestra EDT en verano y EST en invierno", () => {
    const options: Intl.DateTimeFormatOptions = { hour: "numeric", timeZoneName: "short" };

    expect(formatInBusinessTimeZone("2026-06-15T13:05:00Z", "en-US", options)).toBe("9 AM EDT");
    expect(formatInBusinessTimeZone("2026-01-15T13:05:00Z", "en-US", options)).toBe("8 AM EST");
  });

  it("acepta Date, string ISO y timestamp numérico", () => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    const timestamp = Date.UTC(2026, 5, 15, 13, 5);

    expect(formatInBusinessTimeZone(new Date(timestamp), "en-US", options)).toBe("09:05");
    expect(formatInBusinessTimeZone("2026-06-15T13:05:00Z", "en-US", options)).toBe("09:05");
    expect(formatInBusinessTimeZone(timestamp, "en-US", options)).toBe("09:05");
  });

  it("devuelve cadena vacía para entradas inválidas", () => {
    const options: Intl.DateTimeFormatOptions = { dateStyle: "medium" };

    expect(formatInBusinessTimeZone("not-a-date", "en-US", options)).toBe("");
    expect(formatInBusinessTimeZone(new Date(Number.NaN), "en-US", options)).toBe("");
    expect(formatInBusinessTimeZone(Number.NaN, "en-US", options)).toBe("");
  });
});

describe("getBusinessNow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve el instante actual expresado en la zona de negocio", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T13:05:00Z"));

    const now = getBusinessNow();

    expect(now.zoneName).toBe(NEW_YORK_TIMEZONE);
    expect(now.toISO()).toBe("2026-06-15T09:05:00.000-04:00");
    expect(now.toMillis()).toBe(Date.UTC(2026, 5, 15, 13, 5));
  });

  it("usa el offset de invierno cuando no hay horario de verano", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T13:05:00Z"));

    expect(getBusinessNow().toISO()).toBe("2026-01-15T08:05:00.000-05:00");
  });
});

describe("startOfBusinessDay / endOfBusinessDay", () => {
  it("calcula el inicio del día civil de Nueva York (verano e invierno)", () => {
    expect(iso(startOfBusinessDay("2026-06-15T02:00:00Z"))).toBe("2026-06-14T04:00:00.000Z");
    expect(iso(startOfBusinessDay("2026-01-15T04:59:59Z"))).toBe("2026-01-14T05:00:00.000Z");
    expect(iso(startOfBusinessDay("2026-01-15T05:00:00Z"))).toBe("2026-01-15T05:00:00.000Z");
  });

  it("calcula el final del día civil con precisión de milisegundo", () => {
    expect(iso(endOfBusinessDay("2026-06-14T12:00:00Z"))).toBe("2026-06-15T03:59:59.999Z");
    expect(iso(endOfBusinessDay("2026-01-15T12:00:00Z"))).toBe("2026-01-16T04:59:59.999Z");
  });

  it("el día del salto de marzo dura 23 horas", () => {
    const start = startOfBusinessDay(SPRING_FORWARD_NOON_UTC);
    const end = endOfBusinessDay(SPRING_FORWARD_NOON_UTC);

    expect(iso(start)).toBe("2026-03-08T05:00:00.000Z");
    expect(iso(end)).toBe("2026-03-09T03:59:59.999Z");
    expect(end!.getTime() - start!.getTime()).toBe(HOURS_IN_SHORT_DAY * MS_PER_HOUR - 1);
  });

  it("el día del retroceso de noviembre dura 25 horas", () => {
    const start = startOfBusinessDay(FALL_BACK_NOON_UTC);
    const end = endOfBusinessDay(FALL_BACK_NOON_UTC);

    expect(iso(start)).toBe("2026-11-01T04:00:00.000Z");
    expect(iso(end)).toBe("2026-11-02T04:59:59.999Z");
    expect(end!.getTime() - start!.getTime()).toBe(HOURS_IN_LONG_DAY * MS_PER_HOUR - 1);
  });

  it("devuelven null para entradas inválidas", () => {
    expect(startOfBusinessDay("nope")).toBeNull();
    expect(startOfBusinessDay(new Date(Number.NaN))).toBeNull();
    expect(endOfBusinessDay("nope")).toBeNull();
    expect(endOfBusinessDay(Number.NaN)).toBeNull();
  });
});

describe("addBusinessDays", () => {
  it("mantiene la hora de pared al cruzar el salto de marzo (día de 23 h)", () => {
    // 09:00 EST del sábado 7 -> 09:00 EDT del domingo 8.
    const result = addBusinessDays("2026-03-07T14:00:00Z", 1);

    expect(iso(result)).toBe("2026-03-08T13:00:00.000Z");
    expect(result!.getTime() - Date.parse("2026-03-07T14:00:00Z")).toBe(
      HOURS_IN_SHORT_DAY * MS_PER_HOUR
    );
  });

  it("mantiene la hora de pared al cruzar el retroceso de noviembre (día de 25 h)", () => {
    // 09:00 EDT del sábado 31 -> 09:00 EST del domingo 1.
    const result = addBusinessDays("2026-10-31T13:00:00Z", 1);

    expect(iso(result)).toBe("2026-11-01T14:00:00.000Z");
    expect(result!.getTime() - Date.parse("2026-10-31T13:00:00Z")).toBe(
      HOURS_IN_LONG_DAY * MS_PER_HOUR
    );
  });

  it("acepta días negativos y cruza fin de mes y febrero", () => {
    expect(iso(addBusinessDays("2026-03-09T13:00:00Z", -1))).toBe("2026-03-08T13:00:00.000Z");
    expect(iso(addBusinessDays("2026-06-30T13:00:00Z", 1))).toBe("2026-07-01T13:00:00.000Z");
    expect(iso(addBusinessDays("2026-01-31T14:00:00Z", 31))).toBe("2026-03-03T14:00:00.000Z");
  });

  it("con 0 días devuelve el mismo instante en un objeto nuevo sin mutar la entrada", () => {
    const input = new Date("2026-06-15T13:00:00Z");
    const originalTime = input.getTime();

    const result = addBusinessDays(input, 0);

    expect(result).not.toBe(input);
    expect(result!.getTime()).toBe(originalTime);
    expect(input.getTime()).toBe(originalTime);
  });

  it("devuelve null para entradas inválidas", () => {
    expect(addBusinessDays("nope", 1)).toBeNull();
    expect(addBusinessDays(new Date(Number.NaN), 1)).toBeNull();
  });
});

describe("parseBusinessDateInput", () => {
  it("interpreta yyyy-MM-dd como medianoche de Nueva York", () => {
    expect(iso(parseBusinessDateInput("2026-06-15"))).toBe("2026-06-15T04:00:00.000Z");
    expect(iso(parseBusinessDateInput("2026-01-15"))).toBe("2026-01-15T05:00:00.000Z");
  });

  it("usa el offset vigente a medianoche en los días de cambio de horario", () => {
    expect(iso(parseBusinessDateInput(SPRING_FORWARD_DAY))).toBe("2026-03-08T05:00:00.000Z");
    expect(iso(parseBusinessDateInput(FALL_BACK_DAY))).toBe("2026-11-01T04:00:00.000Z");
  });

  it("acepta el 29 de febrero bisiesto y rechaza fechas de calendario inexistentes", () => {
    expect(iso(parseBusinessDateInput("2024-02-29"))).toBe("2024-02-29T05:00:00.000Z");
    expect(parseBusinessDateInput("2026-02-29")).toBeNull();
    expect(parseBusinessDateInput("2026-02-30")).toBeNull();
    expect(parseBusinessDateInput("2026-13-01")).toBeNull();
    expect(parseBusinessDateInput("2026-06-32")).toBeNull();
  });

  it("rechaza cualquier formato distinto de yyyy-MM-dd estricto", () => {
    expect(parseBusinessDateInput("2026-6-15")).toBeNull();
    expect(parseBusinessDateInput("15/06/2026")).toBeNull();
    expect(parseBusinessDateInput("2026-06-15T00:00")).toBeNull();
    expect(parseBusinessDateInput(" 2026-06-15")).toBeNull();
    expect(parseBusinessDateInput("2026-06-15 ")).toBeNull();
    expect(parseBusinessDateInput("")).toBeNull();
  });
});

describe("parseBusinessDateTimeInput", () => {
  it("combina fecha y hora en la zona de negocio (verano e invierno)", () => {
    expect(iso(parseBusinessDateTimeInput("2026-06-15", "09:30"))).toBe(
      "2026-06-15T13:30:00.000Z"
    );
    expect(iso(parseBusinessDateTimeInput("2026-01-15", "09:30"))).toBe(
      "2026-01-15T14:30:00.000Z"
    );
  });

  it("desplaza hacia delante una hora inexistente en el salto de marzo", () => {
    // 02:30 no existe el 8 de marzo: luxon lo convierte en 03:30 EDT.
    expect(iso(parseBusinessDateTimeInput(SPRING_FORWARD_DAY, "02:30"))).toBe(
      "2026-03-08T07:30:00.000Z"
    );
  });

  it("resuelve una hora ambigua de noviembre con la primera ocurrencia (EDT)", () => {
    expect(iso(parseBusinessDateTimeInput(FALL_BACK_DAY, "01:30"))).toBe(
      "2026-11-01T05:30:00.000Z"
    );
    expect(iso(parseBusinessDateTimeInput(FALL_BACK_DAY, "09:00"))).toBe(
      "2026-11-01T14:00:00.000Z"
    );
  });

  it("sustituye silenciosamente por 00:00 cualquier hora que no sea HH:mm exacto", () => {
    const midnight = "2026-06-15T04:00:00.000Z";

    expect(iso(parseBusinessDateTimeInput("2026-06-15", "9:30"))).toBe(midnight);
    expect(iso(parseBusinessDateTimeInput("2026-06-15", "09:30:00"))).toBe(midnight);
    expect(iso(parseBusinessDateTimeInput("2026-06-15", "0930"))).toBe(midnight);
    expect(iso(parseBusinessDateTimeInput("2026-06-15", ""))).toBe(midnight);
  });

  it("devuelve null cuando la hora tiene formato HH:mm pero está fuera de rango", () => {
    expect(parseBusinessDateTimeInput("2026-06-15", "25:00")).toBeNull();
    expect(parseBusinessDateTimeInput("2026-06-15", "23:60")).toBeNull();
    expect(parseBusinessDateTimeInput("2026-06-15", "24:30")).toBeNull();
  });

  it("rechaza 24:00 igual que 25:00 (luxon lo aceptaría como medianoche del día siguiente)", () => {
    expect(parseBusinessDateTimeInput("2026-06-15", "24:00")).toBeNull();
    expect(parseBusinessDateTimeInput("2026-06-15", "24:59")).toBeNull();
  });

  it("acepta los límites del rango 00:00 y 23:59", () => {
    expect(iso(parseBusinessDateTimeInput("2026-06-15", "00:00"))).toBe(
      "2026-06-15T04:00:00.000Z"
    );
    expect(iso(parseBusinessDateTimeInput("2026-06-15", "23:59"))).toBe(
      "2026-06-16T03:59:00.000Z"
    );
  });

  it("devuelve null cuando la fecha es inválida o no tiene formato estricto", () => {
    expect(parseBusinessDateTimeInput("2026-02-30", "09:00")).toBeNull();
    expect(parseBusinessDateTimeInput("2026-6-15", "09:00")).toBeNull();
    expect(parseBusinessDateTimeInput("", "09:00")).toBeNull();
  });
});

describe("formatBusinessDateInput", () => {
  it("devuelve la fecha civil de Nueva York en los límites de medianoche", () => {
    expect(formatBusinessDateInput("2026-06-15T03:59:59Z")).toBe("2026-06-14");
    expect(formatBusinessDateInput("2026-06-15T04:00:00Z")).toBe("2026-06-15");
    expect(formatBusinessDateInput("2026-01-15T04:59:59Z")).toBe("2026-01-14");
    expect(formatBusinessDateInput("2026-01-15T05:00:00Z")).toBe("2026-01-15");
  });

  it("es inversa de parseBusinessDateInput, incluso en días de cambio de horario", () => {
    for (const day of ["2026-06-15", SPRING_FORWARD_DAY, FALL_BACK_DAY, "2024-02-29"]) {
      expect(formatBusinessDateInput(parseBusinessDateInput(day)!)).toBe(day);
    }
  });

  it("devuelve cadena vacía para entradas inválidas", () => {
    expect(formatBusinessDateInput("nope")).toBe("");
    expect(formatBusinessDateInput(new Date(Number.NaN))).toBe("");
  });
});

describe("getBusinessTimeParts", () => {
  it("extrae hora y minuto en la zona de negocio, con medianoche como 0", () => {
    expect(getBusinessTimeParts("2026-06-15T13:05:00Z")).toEqual({ hour: 9, minute: 5 });
    expect(getBusinessTimeParts("2026-01-15T14:05:00Z")).toEqual({ hour: 9, minute: 5 });
    expect(getBusinessTimeParts("2026-06-15T04:00:00Z")).toEqual({ hour: 0, minute: 0 });
  });

  it("refleja el cambio de offset dentro del día del salto de marzo", () => {
    expect(getBusinessTimeParts("2026-03-08T06:30:00Z")).toEqual({ hour: 1, minute: 30 });
    expect(getBusinessTimeParts("2026-03-08T07:30:00Z")).toEqual({ hour: 3, minute: 30 });
  });

  it("devuelve null para entradas inválidas", () => {
    expect(getBusinessTimeParts("nope")).toBeNull();
    expect(getBusinessTimeParts(Number.NaN)).toBeNull();
  });
});

describe("applyBusinessTime", () => {
  it("copia hora y minuto de la fuente sobre la fecha base y pone segundos y ms a cero", () => {
    // Fuente 09:30:45.123 EDT; base en enero -> 09:30 EST.
    const result = applyBusinessTime("2026-01-15T12:00:00Z", "2026-06-15T13:30:45.123Z");

    expect(iso(result)).toBe("2026-01-15T14:30:00.000Z");
  });

  it("usa la fecha civil de Nueva York de la base, no la de UTC", () => {
    // 02:00Z del 15 de junio son las 22:00 EDT del 14 de junio.
    const result = applyBusinessTime("2026-06-15T02:00:00Z", "2026-06-15T13:30:00Z");

    expect(iso(result)).toBe("2026-06-14T13:30:00.000Z");
  });

  it("desplaza hacia delante si la hora resultante cae en el hueco del salto de marzo", () => {
    const twoThirtyEst = "2026-01-15T07:30:00Z";

    const result = applyBusinessTime(SPRING_FORWARD_NOON_UTC, twoThirtyEst);

    expect(iso(result)).toBe("2026-03-08T07:30:00.000Z");
  });

  it("acepta Date, string y número en ambos argumentos", () => {
    const base = new Date("2026-06-15T12:00:00Z");
    const sourceTimestamp = Date.UTC(2026, 0, 15, 14, 30);

    expect(iso(applyBusinessTime(base, sourceTimestamp))).toBe("2026-06-15T13:30:00.000Z");
    expect(iso(applyBusinessTime(base.getTime(), "2026-01-15T14:30:00Z"))).toBe(
      "2026-06-15T13:30:00.000Z"
    );
  });

  it("devuelve null si cualquiera de los dos argumentos es inválido", () => {
    expect(applyBusinessTime("nope", "2026-06-15T13:30:00Z")).toBeNull();
    expect(applyBusinessTime("2026-06-15T12:00:00Z", new Date(Number.NaN))).toBeNull();
  });
});
