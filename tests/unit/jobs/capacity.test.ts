import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  BUSINESS_TIMEZONE,
  MIN_BOOKING_LEAD_DAYS,
  SLOT_INTERVAL_MINUTES,
  SLOT_START_HOUR,
  TECH_DAILY_CAPACITY,
  buildAvailabilityDays,
  getDailyCapacity,
  getLeadStartDate,
  getStartOfDay,
  getTimeSlots,
  getWeekStartKey,
  isSunday,
  minutesToTimeValue,
  parseDateOnly,
  timeValueToMinutes,
  toDateKey,
} from "@/lib/jobs/capacity";
import { BUSINESS_TIMEZONE as TIMEZONE_MODULE_BUSINESS_TIMEZONE } from "@/lib/timezone";

// El módulo de zona horaria lee el entorno en tiempo de import.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

const MINUTES_PER_HOUR = 60;
const LAST_MINUTE_OF_DAY = 24 * MINUTES_PER_HOUR - 1;
const FIRST_SLOT_MINUTES = 8 * MINUTES_PER_HOUR;
const LAST_SLOT_MINUTES = 15 * MINUTES_PER_HOUR + 30;
const DAYS_PER_WEEK = 7;
const WEEKDAYS_PER_WEEK = 5;

/** Los 16 slots de media hora entre 08:00 y 15:30 que produce getTimeSlots(). */
const EXPECTED_SLOT_VALUES = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
];

/** Lunes 15 de junio de 2026 a mediodía UTC (08:00 EDT). */
const MONDAY_NOON_UTC = new Date("2026-06-15T12:00:00Z");
/** Sábado 13 de junio de 2026 a mediodía UTC. */
const SATURDAY_NOON_UTC = new Date("2026-06-13T12:00:00Z");
/** 08:00 EDT del lunes 15 de junio. */
const MONDAY_8AM_EDT = "2026-06-15T12:00:00Z";
/** 08:15 EDT del lunes 15 de junio: no coincide con ningún slot. */
const MONDAY_815AM_EDT = "2026-06-15T12:15:00Z";
/** 15:30 EDT del lunes 15 de junio: último slot. */
const MONDAY_330PM_EDT = "2026-06-15T19:30:00Z";

const slotRemainingByValue = (day: { slots: Array<{ value: string; remaining: number }> }) =>
  Object.fromEntries(day.slots.map((slot) => [slot.value, slot.remaining]));

const uniformSlots = (remaining: number) =>
  EXPECTED_SLOT_VALUES.map((value) => ({ value, remaining }));

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("constantes", () => {
  it("fija la capacidad diaria por técnico, el intervalo y el inicio de los slots", () => {
    expect(TECH_DAILY_CAPACITY).toBe(16);
    expect(SLOT_INTERVAL_MINUTES).toBe(30);
    expect(SLOT_START_HOUR).toBe(8);
    expect(MIN_BOOKING_LEAD_DAYS).toBe(2);
  });

  it("reexporta la misma zona horaria de negocio que @/lib/timezone", () => {
    expect(BUSINESS_TIMEZONE).toBe("America/New_York");
    expect(BUSINESS_TIMEZONE).toBe(TIMEZONE_MODULE_BUSINESS_TIMEZONE);
  });
});

describe("toDateKey", () => {
  it("devuelve la fecha civil de Nueva York en los límites de medianoche (verano e invierno)", () => {
    expect(toDateKey(new Date("2026-06-15T03:59:59Z"))).toBe("2026-06-14");
    expect(toDateKey(new Date("2026-06-15T04:00:00Z"))).toBe("2026-06-15");
    expect(toDateKey(new Date("2026-01-15T04:59:59Z"))).toBe("2026-01-14");
    expect(toDateKey(new Date("2026-01-15T05:00:00Z"))).toBe("2026-01-15");
  });

  it("el día del salto de marzo empieza con offset EST y termina con offset EDT", () => {
    expect(toDateKey(new Date("2026-03-08T04:59:59Z"))).toBe("2026-03-07");
    expect(toDateKey(new Date("2026-03-08T05:00:00Z"))).toBe("2026-03-08");
    expect(toDateKey(new Date("2026-03-09T03:59:59Z"))).toBe("2026-03-08");
    expect(toDateKey(new Date("2026-03-09T04:00:00Z"))).toBe("2026-03-09");
  });

  it("devuelve una clave vacía, sin lanzar, para una Date inválida", () => {
    expect(toDateKey(new Date(Number.NaN))).toBe("");
  });
});

describe("callers de toDateKey con una Date inválida", () => {
  const invalidDate = new Date(Number.NaN);

  it("isSunday devuelve false sin lanzar", () => {
    expect(isSunday(invalidDate)).toBe(false);
  });

  it("getStartOfDay y getLeadStartDate propagan una Invalid Date sin lanzar", () => {
    expect(Number.isNaN(getStartOfDay(invalidDate).getTime())).toBe(true);
    expect(Number.isNaN(getLeadStartDate(invalidDate).getTime())).toBe(true);
  });

  it("getWeekStartKey devuelve la clave vacía sin lanzar", () => {
    expect(getWeekStartKey(invalidDate)).toBe("");
  });

  it("buildAvailabilityDays ignora las fechas programadas inválidas sin lanzar", () => {
    const availability = buildAvailabilityDays({
      startDate: MONDAY_NOON_UTC,
      days: 1,
      techniciansCount: 1,
      scheduledDates: [invalidDate, new Date(MONDAY_8AM_EDT)],
    });

    const [monday] = availability;
    expect(availability).toHaveLength(1);
    expect(monday.date).toBe("2026-06-15");
    expect(monday.usedCapacity).toBe(1);
    expect(slotRemainingByValue(monday)["08:00"]).toBe(0);
  });

  it("buildAvailabilityDays devuelve vacío sin lanzar cuando la fecha de inicio es inválida", () => {
    expect(
      buildAvailabilityDays({
        startDate: invalidDate,
        days: 3,
        techniciansCount: 1,
        scheduledDates: [],
      })
    ).toEqual([]);
  });
});

describe("parseDateOnly", () => {
  it("convierte yyyy-MM-dd en el mediodía UTC de esa fecha", () => {
    expect(parseDateOnly("2026-06-15")?.toISOString()).toBe("2026-06-15T12:00:00.000Z");
    expect(parseDateOnly("2024-02-29")?.toISOString()).toBe("2024-02-29T12:00:00.000Z");
  });

  it("devuelve null para formatos distintos de yyyy-MM-dd estricto", () => {
    for (const value of ["2026-6-15", "", "2026-06-15T00:00", "15/06/2026", " 2026-06-15"]) {
      expect(parseDateOnly(value)).toBeNull();
    }
  });

  it("devuelve null cuando mes o día están fuera de 1..12 / 1..31", () => {
    for (const value of ["2026-00-10", "2026-13-10", "2026-06-00", "2026-06-32"]) {
      expect(parseDateOnly(value)).toBeNull();
    }
  });

  it("devuelve null para días inexistentes del calendario en vez de desbordarlos al mes siguiente", () => {
    for (const value of ["2026-02-30", "2026-04-31", "2026-02-29", "2100-02-29"]) {
      expect(parseDateOnly(value)).toBeNull();
    }
  });

  it("devuelve null para años que Date.UTC remapearía (0026 -> 1926)", () => {
    expect(parseDateOnly("0026-06-15")).toBeNull();
  });
});

describe("isSunday", () => {
  it("decide según el día civil de Nueva York, no según UTC", () => {
    expect(isSunday(new Date("2026-06-14T12:00:00Z"))).toBe(true);
    expect(isSunday(MONDAY_NOON_UTC)).toBe(false);
    // Lunes 02:00Z = domingo 22:00 EDT.
    expect(isSunday(new Date("2026-06-15T02:00:00Z"))).toBe(true);
    // Domingo 03:00Z = sábado 23:00 EDT.
    expect(isSunday(new Date("2026-06-14T03:00:00Z"))).toBe(false);
  });
});

describe("getStartOfDay", () => {
  it("devuelve el mediodía UTC de la fecha civil de Nueva York en un objeto nuevo", () => {
    const input = new Date("2026-06-15T02:00:00Z");
    const originalTime = input.getTime();

    const result = getStartOfDay(input);

    expect(result.toISOString()).toBe("2026-06-14T12:00:00.000Z");
    expect(result).not.toBe(input);
    expect(input.getTime()).toBe(originalTime);
  });
});

describe("getLeadStartDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("suma MIN_BOOKING_LEAD_DAYS por defecto a partir del día civil de Nueva York", () => {
    // Lunes 02:00Z = domingo 14 en Nueva York -> +2 = martes 16.
    expect(getLeadStartDate(new Date("2026-06-15T02:00:00Z")).toISOString()).toBe(
      "2026-06-16T12:00:00.000Z"
    );
  });

  it("acepta un lead personalizado y cruza fin de mes", () => {
    expect(getLeadStartDate(new Date("2026-06-29T12:00:00Z"), 5).toISOString()).toBe(
      "2026-07-04T12:00:00.000Z"
    );
    expect(getLeadStartDate(new Date("2026-12-31T12:00:00Z"), 1).toISOString()).toBe(
      "2027-01-01T12:00:00.000Z"
    );
  });

  it("trata un lead negativo como 0", () => {
    expect(getLeadStartDate(MONDAY_NOON_UTC, -3).toISOString()).toBe("2026-06-15T12:00:00.000Z");
  });

  it("usa la hora del sistema cuando no se pasa fecha", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T13:00:00Z"));

    expect(getLeadStartDate().toISOString()).toBe("2026-06-17T12:00:00.000Z");
  });
});

describe("getWeekStartKey", () => {
  it("devuelve el lunes de la semana (semana que empieza en lunes)", () => {
    expect(getWeekStartKey(new Date("2026-06-17T12:00:00Z"))).toBe("2026-06-15");
    expect(getWeekStartKey(MONDAY_NOON_UTC)).toBe("2026-06-15");
    expect(getWeekStartKey(new Date("2026-06-21T12:00:00Z"))).toBe("2026-06-15");
  });

  it("cruza mes y año hacia atrás cuando el lunes cae en el periodo anterior", () => {
    expect(getWeekStartKey(new Date("2026-07-01T12:00:00Z"))).toBe("2026-06-29");
    expect(getWeekStartKey(new Date("2027-01-01T12:00:00Z"))).toBe("2026-12-28");
  });

  it("usa el día civil de Nueva York para determinar la semana", () => {
    // Lunes 02:00Z = domingo 14 en Nueva York -> semana del lunes 8.
    expect(getWeekStartKey(new Date("2026-06-15T02:00:00Z"))).toBe("2026-06-08");
  });
});

describe("getDailyCapacity", () => {
  it("multiplica técnicos por TECH_DAILY_CAPACITY y trata negativos como 0", () => {
    expect(getDailyCapacity(0)).toBe(0);
    expect(getDailyCapacity(1)).toBe(TECH_DAILY_CAPACITY);
    expect(getDailyCapacity(3)).toBe(3 * TECH_DAILY_CAPACITY);
    expect(getDailyCapacity(-2)).toBe(0);
  });

  it("no redondea técnicos fraccionarios (comportamiento actual)", () => {
    expect(getDailyCapacity(1.5)).toBe(1.5 * TECH_DAILY_CAPACITY);
  });
});

describe("getTimeSlots", () => {
  it("genera 16 slots de 30 minutos desde 08:00 hasta 15:30", () => {
    const slots = getTimeSlots();

    expect(slots).toHaveLength(TECH_DAILY_CAPACITY);
    expect(slots.map((slot) => slot.value)).toEqual(EXPECTED_SLOT_VALUES);
    expect(slots[0]).toEqual({ value: "08:00", minutes: FIRST_SLOT_MINUTES });
    expect(slots.at(-1)).toEqual({ value: "15:30", minutes: LAST_SLOT_MINUTES });
    slots.slice(1).forEach((slot, index) => {
      expect(slot.minutes - slots[index].minutes).toBe(SLOT_INTERVAL_MINUTES);
    });
  });

  it("devuelve un array nuevo en cada llamada", () => {
    expect(getTimeSlots()).not.toBe(getTimeSlots());
    expect(getTimeSlots()).toEqual(getTimeSlots());
  });
});

describe("minutesToTimeValue", () => {
  it("formatea minutos del día como HH:mm", () => {
    expect(minutesToTimeValue(FIRST_SLOT_MINUTES)).toBe("08:00");
    expect(minutesToTimeValue(LAST_SLOT_MINUTES)).toBe("15:30");
    expect(minutesToTimeValue(0)).toBe("00:00");
    expect(minutesToTimeValue(LAST_MINUTE_OF_DAY)).toBe("23:59");
  });

  it("recorta valores fuera de rango a 00:00 o 23:59", () => {
    expect(minutesToTimeValue(-10)).toBe("00:00");
    expect(minutesToTimeValue(LAST_MINUTE_OF_DAY + 1)).toBe("23:59");
    expect(minutesToTimeValue(10_000)).toBe("23:59");
  });

  it("no valida NaN ni fracciones (comportamiento actual)", () => {
    expect(minutesToTimeValue(Number.NaN)).toBe("NaN:NaN");
    expect(minutesToTimeValue(90.5)).toBe("01:30.5");
  });
});

describe("timeValueToMinutes", () => {
  it("convierte HH:mm y H:mm en minutos del día", () => {
    expect(timeValueToMinutes("08:00")).toBe(FIRST_SLOT_MINUTES);
    expect(timeValueToMinutes("15:30")).toBe(LAST_SLOT_MINUTES);
    expect(timeValueToMinutes("00:00")).toBe(0);
    expect(timeValueToMinutes("23:59")).toBe(LAST_MINUTE_OF_DAY);
    expect(timeValueToMinutes("8:30")).toBe(8 * MINUTES_PER_HOUR + 30);
  });

  it("devuelve null fuera de rango o cuando no hay dos partes numéricas", () => {
    for (const value of ["24:00", "-1:00", "abc", "8", "", "ab:cd", "08:xx"]) {
      expect(timeValueToMinutes(value)).toBeNull();
    }
  });

  it("no valida partes vacías: Number('') es 0 (comportamiento actual)", () => {
    expect(timeValueToMinutes("08:")).toBe(FIRST_SLOT_MINUTES);
    expect(timeValueToMinutes(":")).toBe(0);
  });

  it("devuelve null cuando los minutos están fuera de 0..59", () => {
    for (const value of ["08:60", "08:99", "23:60", "08:-5"]) {
      expect(timeValueToMinutes(value)).toBeNull();
    }
  });
});

describe("buildAvailabilityDays", () => {
  it("genera solo días laborables con capacidad completa cuando no hay trabajos", () => {
    const availability = buildAvailabilityDays({
      startDate: MONDAY_NOON_UTC,
      days: DAYS_PER_WEEK,
      techniciansCount: 2,
      scheduledDates: [],
    });

    expect(availability).toHaveLength(WEEKDAYS_PER_WEEK);
    expect(availability.map((day) => day.date)).toEqual([
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
    ]);
    for (const day of availability) {
      expect(day).toEqual({
        date: day.date,
        totalCapacity: 2 * TECH_DAILY_CAPACITY,
        usedCapacity: 0,
        remainingCapacity: 2 * TECH_DAILY_CAPACITY,
        slots: uniformSlots(2),
      });
    }
  });

  it("incluye sábado y/o domingo solo cuando se pide", () => {
    const base = {
      startDate: MONDAY_NOON_UTC,
      days: DAYS_PER_WEEK,
      techniciansCount: 1,
      scheduledDates: [],
    };

    const withSaturday = buildAvailabilityDays({ ...base, includeSaturday: true });
    const withWeekend = buildAvailabilityDays({
      ...base,
      includeSaturday: true,
      includeSunday: true,
    });

    expect(withSaturday.map((day) => day.date)).toContain("2026-06-20");
    expect(withSaturday.map((day) => day.date)).not.toContain("2026-06-21");
    expect(withWeekend.map((day) => day.date)).toEqual([
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
    ]);
  });

  it("trata days <= 0 como 1 y devuelve vacío si ese único día cae en fin de semana excluido", () => {
    const base = { startDate: SATURDAY_NOON_UTC, techniciansCount: 1, scheduledDates: [] };

    expect(buildAvailabilityDays({ ...base, days: 0 })).toEqual([]);
    expect(buildAvailabilityDays({ ...base, days: -5 })).toEqual([]);
    expect(
      buildAvailabilityDays({ ...base, days: 0, includeSaturday: true }).map((day) => day.date)
    ).toEqual(["2026-06-13"]);
  });

  it("normaliza la fecha de inicio al día civil de Nueva York", () => {
    // Martes 02:00Z = lunes 22:00 EDT.
    const availability = buildAvailabilityDays({
      startDate: new Date("2026-06-16T02:00:00Z"),
      days: 1,
      techniciansCount: 1,
      scheduledDates: [],
    });

    expect(availability.map((day) => day.date)).toEqual(["2026-06-15"]);
  });

  it("descuenta cada trabajo de su slot y de la capacidad total del día", () => {
    const availability = buildAvailabilityDays({
      startDate: MONDAY_NOON_UTC,
      days: 1,
      techniciansCount: 2,
      scheduledDates: [
        new Date(MONDAY_8AM_EDT),
        new Date(MONDAY_8AM_EDT),
        new Date(MONDAY_330PM_EDT),
      ],
    });

    const [monday] = availability;
    expect(monday.usedCapacity).toBe(3);
    expect(monday.remainingCapacity).toBe(2 * TECH_DAILY_CAPACITY - 3);
    expect(slotRemainingByValue(monday)).toEqual({
      ...Object.fromEntries(EXPECTED_SLOT_VALUES.map((value) => [value, 2])),
      "08:00": 0,
      "15:30": 1,
    });
  });

  it("nunca deja valores negativos cuando un slot o el día exceden su capacidad", () => {
    const availability = buildAvailabilityDays({
      startDate: MONDAY_NOON_UTC,
      days: 1,
      techniciansCount: 1,
      scheduledDates: Array.from({ length: 3 }, () => new Date(MONDAY_8AM_EDT)),
    });

    const [monday] = availability;
    expect(monday.usedCapacity).toBe(3);
    expect(monday.remainingCapacity).toBe(TECH_DAILY_CAPACITY - 3);
    expect(slotRemainingByValue(monday)["08:00"]).toBe(0);
    expect(slotRemainingByValue(monday)["08:30"]).toBe(1);
  });

  it("reparte los trabajos fuera de slot sobre los primeros slots con hueco", () => {
    const availability = buildAvailabilityDays({
      startDate: MONDAY_NOON_UTC,
      days: 1,
      techniciansCount: 1,
      scheduledDates: [new Date(MONDAY_8AM_EDT), new Date(MONDAY_815AM_EDT)],
    });

    const [monday] = availability;
    expect(monday.usedCapacity).toBe(2);
    expect(monday.remainingCapacity).toBe(TECH_DAILY_CAPACITY - 2);
    expect(slotRemainingByValue(monday)).toEqual({
      ...Object.fromEntries(EXPECTED_SLOT_VALUES.map((value) => [value, 1])),
      "08:00": 0,
      "08:30": 0,
    });
  });

  it("agota todos los slots sin negativos cuando hay más trabajos fuera de slot que capacidad", () => {
    const overbooked = TECH_DAILY_CAPACITY + 1;

    const availability = buildAvailabilityDays({
      startDate: MONDAY_NOON_UTC,
      days: 1,
      techniciansCount: 1,
      scheduledDates: Array.from({ length: overbooked }, () => new Date(MONDAY_815AM_EDT)),
    });

    const [monday] = availability;
    expect(monday.usedCapacity).toBe(overbooked);
    expect(monday.remainingCapacity).toBe(0);
    expect(monday.slots).toEqual(uniformSlots(0));
  });

  it("asigna cada trabajo al día civil de Nueva York e ignora los que caen fuera de la ventana", () => {
    const availability = buildAvailabilityDays({
      startDate: MONDAY_NOON_UTC,
      days: DAYS_PER_WEEK,
      techniciansCount: 1,
      scheduledDates: [
        // 23:30 EDT del lunes 15 -> fuera de slot, cuenta en el 15.
        new Date("2026-06-16T03:30:00Z"),
        // 00:00 EDT del martes 16 -> fuera de slot, cuenta en el 16.
        new Date("2026-06-16T04:00:00Z"),
        // Lunes 22: fuera de la ventana de 7 días.
        new Date("2026-06-22T12:00:00Z"),
      ],
    });

    const usedByDate = Object.fromEntries(
      availability.map((day) => [day.date, day.usedCapacity])
    );
    expect(usedByDate).toEqual({
      "2026-06-15": 1,
      "2026-06-16": 1,
      "2026-06-17": 0,
      "2026-06-18": 0,
      "2026-06-19": 0,
    });
    expect(slotRemainingByValue(availability[0])["08:00"]).toBe(0);
    expect(slotRemainingByValue(availability[1])["08:00"]).toBe(0);
  });

  it("resuelve los slots correctamente a ambos lados del salto de marzo", () => {
    const availability = buildAvailabilityDays({
      startDate: new Date("2026-03-07T12:00:00Z"),
      days: 3,
      techniciansCount: 1,
      scheduledDates: [
        new Date("2026-03-07T13:00:00Z"), // 08:00 EST sábado 7
        new Date("2026-03-08T12:00:00Z"), // 08:00 EDT domingo 8
        new Date("2026-03-08T13:00:00Z"), // 09:00 EDT domingo 8
        new Date("2026-03-09T12:00:00Z"), // 08:00 EDT lunes 9
      ],
      includeSaturday: true,
      includeSunday: true,
    });

    expect(availability.map((day) => day.date)).toEqual([
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
    ]);
    const [saturday, sunday, monday] = availability;
    expect(slotRemainingByValue(saturday)["08:00"]).toBe(0);
    expect(slotRemainingByValue(saturday)["09:00"]).toBe(1);
    expect(sunday.usedCapacity).toBe(2);
    expect(slotRemainingByValue(sunday)["08:00"]).toBe(0);
    expect(slotRemainingByValue(sunday)["09:00"]).toBe(0);
    expect(slotRemainingByValue(monday)["08:00"]).toBe(0);
  });

  it("con 0 técnicos o un número negativo no hay capacidad en ningún slot", () => {
    for (const techniciansCount of [0, -3]) {
      const [monday] = buildAvailabilityDays({
        startDate: MONDAY_NOON_UTC,
        days: 1,
        techniciansCount,
        scheduledDates: [new Date(MONDAY_8AM_EDT)],
      });

      expect(monday.totalCapacity).toBe(0);
      expect(monday.usedCapacity).toBe(1);
      expect(monday.remainingCapacity).toBe(0);
      expect(monday.slots).toEqual(uniformSlots(0));
    }
  });

  it("no muta la fecha de inicio ni las fechas programadas", () => {
    const startDate = new Date("2026-06-16T02:00:00Z");
    const scheduledDates = [new Date(MONDAY_8AM_EDT), new Date(MONDAY_815AM_EDT)];
    const startSnapshot = startDate.getTime();
    const scheduledSnapshot = scheduledDates.map((date) => date.getTime());

    buildAvailabilityDays({ startDate, days: 2, techniciansCount: 1, scheduledDates });

    expect(startDate.getTime()).toBe(startSnapshot);
    expect(scheduledDates.map((date) => date.getTime())).toEqual(scheduledSnapshot);
    expect(scheduledDates).toHaveLength(2);
  });
});
