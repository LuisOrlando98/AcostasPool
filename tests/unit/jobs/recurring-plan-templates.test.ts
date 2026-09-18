import { afterAll, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_SERVICE_PLAN_NAME,
  DEFAULT_GLOBAL_PLAN_TIME,
  GLOBAL_RECURRING_PLAN_OPTIONS,
  buildRecurringRouteGroupId,
  buildRecurringRouteGroupLabel,
  getGlobalRecurringPlan,
  getGlobalRecurringPlanByWeekday,
  getGlobalRecurringPlanKeyByName,
  getRecurringPlanLabelKey,
  isGlobalRecurringPlanName,
  resolveGlobalPlanStartDate,
} from "@/lib/jobs/recurring-plan-templates";

// El módulo de zona horaria lee el entorno en tiempo de import.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_TIMEZONE", "America/New_York");
});

const WORKING_DAYS_COUNT = 6;
const MONDAY_WEEKDAY = 1;
const SATURDAY_WEEKDAY = 6;
const SUNDAY_WEEKDAY_LUXON = 7;
const SUNDAY_WEEKDAY_JS = 0;

/** Semana de referencia: lunes 15 de junio de 2026 (EDT). */
const MONDAY_JUNE_15 = "2026-06-15";
const THURSDAY_JUNE_18 = "2026-06-18";
const SUNDAY_JUNE_14 = "2026-06-14";
/** Jueves 5 de marzo de 2026 (EST): la semana siguiente ya está en EDT. */
const THURSDAY_MARCH_5 = "2026-03-05";
/** Jueves 29 de octubre de 2026 (EDT): la semana siguiente ya está en EST. */
const THURSDAY_OCTOBER_29 = "2026-10-29";

const iso = (value: Date) => value.toISOString();

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("constantes", () => {
  it("expone la hora por defecto y el nombre del plan personalizado", () => {
    expect(DEFAULT_GLOBAL_PLAN_TIME).toBe("09:00");
    expect(CUSTOM_SERVICE_PLAN_NAME).toBe("Custom Service");
  });

  it("define seis planes globales de lunes a sábado con weekday 1..6", () => {
    expect(GLOBAL_RECURRING_PLAN_OPTIONS).toHaveLength(WORKING_DAYS_COUNT);
    expect(GLOBAL_RECURRING_PLAN_OPTIONS.map((option) => option.value)).toEqual([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ]);
    expect(GLOBAL_RECURRING_PLAN_OPTIONS.map((option) => option.weekday)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(GLOBAL_RECURRING_PLAN_OPTIONS.map((option) => option.name)).toEqual([
      "Monday Plan",
      "Tuesday Plan",
      "Wednesday Plan",
      "Thursday Plan",
      "Friday Plan",
      "Saturday Plan",
    ]);
    expect(GLOBAL_RECURRING_PLAN_OPTIONS.map((option) => option.labelKey)).toEqual([
      "admin.customers.detail.plans.globalOptions.monday",
      "admin.customers.detail.plans.globalOptions.tuesday",
      "admin.customers.detail.plans.globalOptions.wednesday",
      "admin.customers.detail.plans.globalOptions.thursday",
      "admin.customers.detail.plans.globalOptions.friday",
      "admin.customers.detail.plans.globalOptions.saturday",
    ]);
  });
});

describe("getGlobalRecurringPlan", () => {
  it("encuentra la opción por clave exacta y devuelve null para claves desconocidas", () => {
    expect(getGlobalRecurringPlan("MONDAY")).toEqual({
      value: "MONDAY",
      name: "Monday Plan",
      weekday: MONDAY_WEEKDAY,
      labelKey: "admin.customers.detail.plans.globalOptions.monday",
    });
    expect(getGlobalRecurringPlan("SUNDAY")).toBeNull();
    expect(getGlobalRecurringPlan("monday")).toBeNull();
    expect(getGlobalRecurringPlan("")).toBeNull();
  });
});

describe("getGlobalRecurringPlanByWeekday", () => {
  it("mapea weekday 1..6 a los planes y devuelve null fuera de ese rango", () => {
    expect(getGlobalRecurringPlanByWeekday(MONDAY_WEEKDAY)?.value).toBe("MONDAY");
    expect(getGlobalRecurringPlanByWeekday(SATURDAY_WEEKDAY)?.value).toBe("SATURDAY");
    expect(getGlobalRecurringPlanByWeekday(SUNDAY_WEEKDAY_JS)).toBeNull();
    expect(getGlobalRecurringPlanByWeekday(SUNDAY_WEEKDAY_LUXON)).toBeNull();
    expect(getGlobalRecurringPlanByWeekday(Number.NaN)).toBeNull();
  });
});

describe("búsquedas por nombre de plan", () => {
  it("getRecurringPlanLabelKey devuelve la clave i18n solo para nombres globales exactos", () => {
    expect(getRecurringPlanLabelKey("Monday Plan")).toBe(
      "admin.customers.detail.plans.globalOptions.monday"
    );
    expect(getRecurringPlanLabelKey(CUSTOM_SERVICE_PLAN_NAME)).toBeNull();
    expect(getRecurringPlanLabelKey("monday plan")).toBeNull();
  });

  it("getGlobalRecurringPlanKeyByName devuelve la clave del plan o null", () => {
    expect(getGlobalRecurringPlanKeyByName("Friday Plan")).toBe("FRIDAY");
    expect(getGlobalRecurringPlanKeyByName("Friday plan")).toBeNull();
    expect(getGlobalRecurringPlanKeyByName("")).toBeNull();
  });

  it("isGlobalRecurringPlanName distingue nombres globales de personalizados (sensible a mayúsculas)", () => {
    expect(isGlobalRecurringPlanName("Saturday Plan")).toBe(true);
    expect(isGlobalRecurringPlanName("saturday plan")).toBe(false);
    expect(isGlobalRecurringPlanName(" Saturday Plan")).toBe(false);
    expect(isGlobalRecurringPlanName(CUSTOM_SERVICE_PLAN_NAME)).toBe(false);
  });
});

describe("buildRecurringRouteGroupId", () => {
  it("usa la clave del plan global y el id del técnico recortado", () => {
    expect(buildRecurringRouteGroupId({ planName: "Monday Plan", technicianId: "tech_1" })).toBe(
      "MONDAY::tech_1"
    );
    expect(buildRecurringRouteGroupId({ planName: "Monday Plan", technicianId: "  tech_1 " })).toBe(
      "MONDAY::tech_1"
    );
  });

  it("usa UNASSIGNED cuando no hay técnico, es null o solo espacios", () => {
    expect(buildRecurringRouteGroupId({ planName: "Monday Plan" })).toBe("MONDAY::UNASSIGNED");
    expect(buildRecurringRouteGroupId({ planName: "Monday Plan", technicianId: null })).toBe(
      "MONDAY::UNASSIGNED"
    );
    expect(buildRecurringRouteGroupId({ planName: "Monday Plan", technicianId: "   " })).toBe(
      "MONDAY::UNASSIGNED"
    );
  });

  it("normaliza nombres no globales a mayúsculas con guiones bajos", () => {
    expect(buildRecurringRouteGroupId({ planName: CUSTOM_SERVICE_PLAN_NAME })).toBe(
      "CUSTOM_SERVICE::UNASSIGNED"
    );
    expect(buildRecurringRouteGroupId({ planName: "  Pool & Spa -- Deluxe! " })).toBe(
      "POOL_SPA_DELUXE::UNASSIGNED"
    );
    expect(buildRecurringRouteGroupId({ planName: "monday plan" })).toBe(
      "MONDAY_PLAN::UNASSIGNED"
    );
    expect(buildRecurringRouteGroupId({ planName: "Añejo" })).toBe("A_EJO::UNASSIGNED");
  });

  it("cae en PLAN cuando el nombre queda vacío tras normalizar", () => {
    expect(buildRecurringRouteGroupId({ planName: "" })).toBe("PLAN::UNASSIGNED");
    expect(buildRecurringRouteGroupId({ planName: "!!!" })).toBe("PLAN::UNASSIGNED");
    expect(buildRecurringRouteGroupId({ planName: "   ", technicianId: "t9" })).toBe("PLAN::t9");
  });
});

describe("buildRecurringRouteGroupLabel", () => {
  it("concatena nombre del plan y técnico recortado con ' :: '", () => {
    expect(
      buildRecurringRouteGroupLabel({ planName: "Monday Plan", technicianName: "  John Doe " })
    ).toBe("Monday Plan :: John Doe");
  });

  it("usa Unassigned si el técnico falta, es null o solo espacios, sin recortar el nombre del plan", () => {
    expect(buildRecurringRouteGroupLabel({ planName: "Monday Plan" })).toBe(
      "Monday Plan :: Unassigned"
    );
    expect(buildRecurringRouteGroupLabel({ planName: "Monday Plan", technicianName: null })).toBe(
      "Monday Plan :: Unassigned"
    );
    expect(buildRecurringRouteGroupLabel({ planName: " Custom ", technicianName: "  " })).toBe(
      " Custom  :: Unassigned"
    );
  });
});

describe("resolveGlobalPlanStartDate", () => {
  it("devuelve el mismo día a las 09:00 cuando la fecha ya cae en el weekday del plan", () => {
    expect(iso(resolveGlobalPlanStartDate(MONDAY_JUNE_15, "MONDAY"))).toBe(
      "2026-06-15T13:00:00.000Z"
    );
  });

  it("avanza dentro de la misma semana hasta el weekday del plan", () => {
    expect(iso(resolveGlobalPlanStartDate(MONDAY_JUNE_15, "WEDNESDAY"))).toBe(
      "2026-06-17T13:00:00.000Z"
    );
    expect(iso(resolveGlobalPlanStartDate(MONDAY_JUNE_15, "SATURDAY"))).toBe(
      "2026-06-20T13:00:00.000Z"
    );
  });

  it("salta a la semana siguiente cuando el weekday del plan ya pasó", () => {
    expect(iso(resolveGlobalPlanStartDate(THURSDAY_JUNE_18, "MONDAY"))).toBe(
      "2026-06-22T13:00:00.000Z"
    );
    expect(iso(resolveGlobalPlanStartDate(THURSDAY_JUNE_18, "WEDNESDAY"))).toBe(
      "2026-06-24T13:00:00.000Z"
    );
  });

  it("desde un domingo (weekday 7 en luxon) avanza al lunes siguiente o al sábado de esa semana", () => {
    expect(iso(resolveGlobalPlanStartDate(SUNDAY_JUNE_14, "MONDAY"))).toBe(
      "2026-06-15T13:00:00.000Z"
    );
    expect(iso(resolveGlobalPlanStartDate(SUNDAY_JUNE_14, "SATURDAY"))).toBe(
      "2026-06-20T13:00:00.000Z"
    );
  });

  it("acepta una hora personalizada, incluso con un solo dígito de hora", () => {
    expect(iso(resolveGlobalPlanStartDate(MONDAY_JUNE_15, "MONDAY", "14:30"))).toBe(
      "2026-06-15T18:30:00.000Z"
    );
    expect(iso(resolveGlobalPlanStartDate(MONDAY_JUNE_15, "TUESDAY", "7:05"))).toBe(
      "2026-06-16T11:05:00.000Z"
    );
  });

  it("mantiene las 09:00 de pared al cruzar el salto de marzo", () => {
    // Jueves 5 (EST, 14:00Z) -> lunes 9 (EDT, 13:00Z).
    expect(iso(resolveGlobalPlanStartDate(THURSDAY_MARCH_5, "MONDAY"))).toBe(
      "2026-03-09T13:00:00.000Z"
    );
    expect(iso(resolveGlobalPlanStartDate(THURSDAY_MARCH_5, "THURSDAY"))).toBe(
      "2026-03-05T14:00:00.000Z"
    );
  });

  it("mantiene las 09:00 de pared al cruzar el retroceso de noviembre", () => {
    // Jueves 29 de octubre (EDT, 13:00Z) -> martes 3 de noviembre (EST, 14:00Z).
    expect(iso(resolveGlobalPlanStartDate(THURSDAY_OCTOBER_29, "TUESDAY"))).toBe(
      "2026-11-03T14:00:00.000Z"
    );
  });

  it("devuelve la fecha combinada sin ajustar cuando la clave del plan no existe", () => {
    expect(iso(resolveGlobalPlanStartDate(THURSDAY_JUNE_18, "SUNDAY"))).toBe(
      "2026-06-18T13:00:00.000Z"
    );
    expect(iso(resolveGlobalPlanStartDate(THURSDAY_JUNE_18, ""))).toBe(
      "2026-06-18T13:00:00.000Z"
    );
  });

  it("propaga Invalid Date cuando la fecha o la hora no son válidas", () => {
    expect(Number.isNaN(resolveGlobalPlanStartDate("2026-02-30", "MONDAY").getTime())).toBe(true);
    expect(Number.isNaN(resolveGlobalPlanStartDate("2026-6-15", "MONDAY").getTime())).toBe(true);
    expect(Number.isNaN(resolveGlobalPlanStartDate(MONDAY_JUNE_15, "MONDAY", "").getTime())).toBe(
      true
    );
    expect(
      Number.isNaN(resolveGlobalPlanStartDate(MONDAY_JUNE_15, "MONDAY", "25:00").getTime())
    ).toBe(true);
  });
});
