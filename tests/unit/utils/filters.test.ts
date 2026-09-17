import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInvoiceWhere,
  buildJobWhere,
  buildQueryParams,
  formatDateInput,
  getReportFilters,
  type ReportFilters,
} from "@/lib/reports/filters";
import {
  addBusinessDays,
  endOfBusinessDay,
  formatBusinessDateInput,
  parseBusinessDateInput,
  startOfBusinessDay,
} from "@/lib/timezone";

const NOW = new Date("2026-09-16T15:30:00Z");
const DEFAULT_RANGE_DAYS = 30;
const WEEK_RANGE_DAYS = 7;

const startOf = (date: Date) => startOfBusinessDay(date) as Date;
const endOf = (date: Date) => endOfBusinessDay(date) as Date;
const daysAgo = (days: number) => addBusinessDays(NOW, -days) as Date;
const businessDate = (value: string) => parseBusinessDateInput(value) as Date;

describe("getReportFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to the last 30 days when no params are given", () => {
    const filters = getReportFilters();

    expect(filters.range).toBe("30");
    expect(filters.from).toEqual(startOf(daysAgo(DEFAULT_RANGE_DAYS - 1)));
    expect(filters.to).toEqual(endOf(NOW));
    expect(filters.technicianId).toBeUndefined();
    expect(filters.serviceType).toBeUndefined();
    expect(filters.priority).toBeUndefined();
  });

  it("uses the current business day for range=today (case-insensitive)", () => {
    const filters = getReportFilters({ range: "TODAY" });

    expect(filters.range).toBe("today");
    expect(filters.from).toEqual(startOf(NOW));
    expect(filters.to).toEqual(endOf(NOW));
  });

  it("uses a numeric range as a day preset ending today", () => {
    const filters = getReportFilters({ range: String(WEEK_RANGE_DAYS) });

    expect(filters.range).toBe("7");
    expect(filters.from).toEqual(startOf(daysAgo(WEEK_RANGE_DAYS - 1)));
    expect(filters.to).toEqual(endOf(NOW));
  });

  it.each(["0", "-5", "abc"])(
    "falls back to the default window for non-positive or non-numeric range %p",
    (range) => {
      const filters = getReportFilters({ range });

      expect(filters.range).toBe("30");
      expect(filters.from).toEqual(startOf(daysAgo(DEFAULT_RANGE_DAYS - 1)));
    }
  );

  it("uses explicit from/to as a custom range", () => {
    const filters = getReportFilters({ from: "2024-05-01", to: "2024-05-31" });

    expect(filters.range).toBe("custom");
    expect(filters.from).toEqual(startOf(businessDate("2024-05-01")));
    expect(filters.to).toEqual(endOf(businessDate("2024-05-31")));
  });

  it("swaps from and to when they are reversed", () => {
    const filters = getReportFilters({ from: "2024-05-31", to: "2024-05-01" });

    expect(filters.from).toEqual(startOf(businessDate("2024-05-01")));
    expect(filters.to).toEqual(endOf(businessDate("2024-05-31")));
  });

  it("lets a day preset win over explicit from/to", () => {
    const filters = getReportFilters({
      range: "7",
      from: "2024-05-01",
      to: "2024-05-31",
    });

    expect(filters.range).toBe("7");
    expect(filters.to).toEqual(endOf(NOW));
  });

  it("accepts ISO date-times through the Date fallback parser", () => {
    const iso = "2024-05-10T15:00:00Z";
    const filters = getReportFilters({ from: iso, to: iso });

    expect(filters.from).toEqual(startOf(new Date(iso)));
    expect(filters.to).toEqual(endOf(new Date(iso)));
  });

  it("ignores unparsable dates and falls back to the default window", () => {
    const filters = getReportFilters({ from: "not-a-date", to: "also-bad" });

    expect(filters.range).toBe("30");
    expect(filters.to).toEqual(endOf(NOW));
  });

  it("takes the first value of array params", () => {
    const filters = getReportFilters({
      range: ["today", "7"],
      technicianId: ["t1", "t2"],
    });

    expect(filters.range).toBe("today");
    expect(filters.technicianId).toBe("t1");
  });

  it("passes technicianId, serviceType and priority through and drops empty strings", () => {
    const filters = getReportFilters({
      technicianId: "tech-1",
      serviceType: "CLEANING",
      priority: "",
    });

    expect(filters.technicianId).toBe("tech-1");
    expect(filters.serviceType).toBe("CLEANING");
    expect(filters.priority).toBeUndefined();
  });

  it("honours a lone 'from' param and closes the window today", () => {
    const filters = getReportFilters({ from: "2024-05-10" });

    expect(filters.range).toBe("custom");
    expect(filters.from).toEqual(startOf(businessDate("2024-05-10")));
    expect(filters.to).toEqual(endOf(NOW));
  });

  it("honours a lone 'to' param and opens a default-length window ending on it", () => {
    const to = businessDate("2024-05-10");
    const expectedFrom = addBusinessDays(to, -(DEFAULT_RANGE_DAYS - 1)) as Date;

    const filters = getReportFilters({ to: "2024-05-10" });

    expect(filters.range).toBe("custom");
    expect(filters.from).toEqual(startOf(expectedFrom));
    expect(filters.to).toEqual(endOf(to));
  });

  it("swaps a lone 'from' in the future so the window runs from today until that date", () => {
    const filters = getReportFilters({ from: "2027-01-10" });

    expect(filters.range).toBe("custom");
    expect(filters.from).toEqual(startOf(NOW));
    expect(filters.to).toEqual(endOf(businessDate("2027-01-10")));
  });
});

describe("formatDateInput", () => {
  it("delegates to formatBusinessDateInput", () => {
    const date = new Date("2024-05-10T12:00:00Z");
    expect(formatDateInput(date)).toBe(formatBusinessDateInput(date));
  });
});

describe("buildJobWhere", () => {
  const base: ReportFilters = {
    from: new Date("2024-05-01T00:00:00Z"),
    to: new Date("2024-05-31T23:59:59Z"),
    range: "custom",
  };

  it("only filters by scheduledDate when optional filters are absent", () => {
    expect(buildJobWhere(base)).toEqual({
      scheduledDate: { gte: base.from, lte: base.to },
    });
  });

  it("adds technicianId, serviceType and priority when present", () => {
    expect(
      buildJobWhere({
        ...base,
        technicianId: "t1",
        serviceType: "CLEANING",
        priority: "HIGH",
      })
    ).toEqual({
      scheduledDate: { gte: base.from, lte: base.to },
      technicianId: "t1",
      serviceType: "CLEANING",
      priority: "HIGH",
    });
  });
});

describe("buildInvoiceWhere", () => {
  it("filters invoices by createdAt only", () => {
    const from = new Date("2024-05-01T00:00:00Z");
    const to = new Date("2024-05-31T23:59:59Z");

    expect(
      buildInvoiceWhere({ from, to, range: "custom", technicianId: "ignored" })
    ).toEqual({ createdAt: { gte: from, lte: to } });
  });
});

describe("buildQueryParams", () => {
  const from = businessDate("2024-05-01");
  const to = businessDate("2024-05-31");

  it("always includes from and to as business dates", () => {
    expect(buildQueryParams({ from, to, range: "custom" })).toBe(
      "from=2024-05-01&to=2024-05-31"
    );
  });

  it("includes the range unless it is custom", () => {
    expect(buildQueryParams({ from, to, range: "30" })).toBe(
      "from=2024-05-01&to=2024-05-31&range=30"
    );
    expect(buildQueryParams({ from, to, range: "today" })).toContain("range=today");
  });

  it("appends the optional filters in a stable order", () => {
    expect(
      buildQueryParams({
        from,
        to,
        range: "7",
        technicianId: "t 1",
        serviceType: "CLEANING",
        priority: "HIGH",
      })
    ).toBe(
      "from=2024-05-01&to=2024-05-31&range=7&technicianId=t+1&serviceType=CLEANING&priority=HIGH"
    );
  });
});
