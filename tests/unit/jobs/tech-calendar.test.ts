import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  formatMonthKey,
  getCurrentMonth,
  getMonthGridRange,
  parseMonthKey,
  planOccurrenceKey,
  projectPlanOccurrences,
  resolveSelectedDay,
  shiftMonth,
  toBusinessDateKey,
} from "@/lib/jobs/tech-calendar";

// BUSINESS_TIMEZONE es America/New_York en las pruebas (sin variable de entorno).
const SEPTEMBER_2026 = { year: 2026, month: 9 } as const;

describe("parseMonthKey / formatMonthKey / shiftMonth", () => {
  it("accepts yyyy-MM and rejects anything else", () => {
    expect(parseMonthKey("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(parseMonthKey(" 2026-12 ")).toEqual({ year: 2026, month: 12 });
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("2026-9")).toBeNull();
    expect(parseMonthKey("september")).toBeNull();
    expect(parseMonthKey(undefined)).toBeNull();
  });

  it("formats and shifts across year boundaries", () => {
    expect(formatMonthKey(SEPTEMBER_2026)).toBe("2026-09");
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("resolves the current month in the business time zone", () => {
    // 2026-10-01T02:30Z is still 30 September in New York.
    expect(getCurrentMonth(new Date("2026-10-01T02:30:00Z"))).toEqual(SEPTEMBER_2026);
  });
});

describe("buildMonthGrid", () => {
  it("starts on Monday, ends on Sunday and marks the days outside the month", () => {
    // 1 Sep 2026 is a Tuesday: the grid starts on Monday 31 Aug and ends on Sunday 4 Oct.
    const weeks = buildMonthGrid(SEPTEMBER_2026);

    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0]).toEqual({ dateKey: "2026-08-31", dayOfMonth: 31, inMonth: false });
    expect(weeks[0][1]).toEqual({ dateKey: "2026-09-01", dayOfMonth: 1, inMonth: true });
    expect(weeks[4][6]).toEqual({ dateKey: "2026-10-04", dayOfMonth: 4, inMonth: false });
    expect(weeks.flat().filter((cell) => cell.inMonth)).toHaveLength(30);
  });

  it("covers six weeks when the month needs them", () => {
    // 1 Aug 2026 is a Saturday and August has 31 days: Mon 27 Jul .. Sun 6 Sep.
    const weeks = buildMonthGrid({ year: 2026, month: 8 });
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0].dateKey).toBe("2026-07-27");
    expect(weeks[5][6].dateKey).toBe("2026-09-06");
  });

  it("exposes the same range as instants for the database query", () => {
    const { start, end } = getMonthGridRange(SEPTEMBER_2026);
    expect(toBusinessDateKey(start)).toBe("2026-08-31");
    expect(toBusinessDateKey(end)).toBe("2026-10-04");
    // Monday 00:00 New York (EDT, UTC-4).
    expect(start.toISOString()).toBe("2026-08-31T04:00:00.000Z");
  });
});

describe("resolveSelectedDay", () => {
  it("keeps a requested day inside the month, falls back to today, then to the 1st", () => {
    expect(resolveSelectedDay("2026-09-14", SEPTEMBER_2026, "2026-09-18")).toBe("2026-09-14");
    expect(resolveSelectedDay("2026-10-02", SEPTEMBER_2026, "2026-09-18")).toBe("2026-09-18");
    expect(resolveSelectedDay("not-a-date", SEPTEMBER_2026, "2026-09-18")).toBe("2026-09-18");
    expect(resolveSelectedDay(undefined, SEPTEMBER_2026, "2026-11-03")).toBe("2026-09-01");
  });
});

describe("projectPlanOccurrences", () => {
  const range = {
    rangeStart: new Date("2026-08-31T04:00:00.000Z"),
    rangeEnd: new Date("2026-10-05T03:59:59.999Z"),
  };

  it("advances a plan into the range and emits every occurrence until the end", () => {
    // Weekly plan whose next run is Monday 10 Aug 2026 09:00 New York.
    const plan = { id: "plan-a", nextRunAt: new Date("2026-08-10T13:00:00.000Z"), frequency: "WEEKLY" };

    const occurrences = projectPlanOccurrences([plan], { ...range, existingKeys: new Set() });

    expect(occurrences.map((item) => item.dateKey)).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
    expect(occurrences[0].plan).toBe(plan);
    // Keeps the local time of the plan across the projection.
    expect(occurrences[0].scheduledDate.toISOString()).toBe("2026-08-31T13:00:00.000Z");
  });

  it("skips the dates that already exist as jobs and honours the frequency", () => {
    const plan = { id: "plan-b", nextRunAt: new Date("2026-09-02T12:00:00.000Z"), frequency: "BIWEEKLY" };
    const existingKeys = new Set([planOccurrenceKey("plan-b", new Date("2026-09-16T12:00:00.000Z"))]);

    const occurrences = projectPlanOccurrences([plan], { ...range, existingKeys });

    expect(occurrences.map((item) => item.dateKey)).toEqual(["2026-09-02", "2026-09-30"]);
  });

  it("returns nothing for a plan whose next run is after the range", () => {
    const plan = { id: "plan-c", nextRunAt: new Date("2026-11-01T12:00:00.000Z"), frequency: "MONTHLY" };
    expect(projectPlanOccurrences([plan], { ...range, existingKeys: new Set() })).toEqual([]);
  });
});
