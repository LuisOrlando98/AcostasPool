import { describe, expect, it } from "vitest";
import type { AssistantStop } from "@/lib/routing/assistant-types";
import {
  alignDateToPlanWeekday,
  buildCalendarHref,
  countActiveStops,
  countDriveSources,
  formatDrive,
  formatMinutes,
} from "@/components/routes/assistant/format";

function makeStop(overrides: Partial<AssistantStop> = {}): AssistantStop {
  return {
    jobId: "job-1",
    customerName: "Cliente Demo",
    address: "1 Main St",
    propertyName: null,
    planName: null,
    routeGroupId: null,
    routeGroupLabel: null,
    technicianId: "tech-1",
    technicianName: "Tecnico Demo",
    order: 1,
    scheduledTime: "09:00",
    estimatedArrivalTime: "09:12",
    serviceStartTime: "09:12",
    estimatedDriveMinutesFromPrevious: 12,
    estimatedServiceMinutes: 45,
    distanceMilesFromPrevious: 4.1,
    delayMinutes: null,
    status: "SCHEDULED",
    currentTechnicianId: "tech-1",
    currentTechnicianName: "Tecnico Demo",
    currentSortOrder: 540,
    hasCoordinates: true,
    ...overrides,
  };
}

describe("formatMinutes", () => {
  it("shows only minutes below one hour", () => {
    expect(formatMinutes(40)).toBe("40m");
    expect(formatMinutes(0)).toBe("0m");
  });

  it("shows hours and zero-padded minutes from one hour up", () => {
    expect(formatMinutes(95)).toBe("1h 35m");
    expect(formatMinutes(125)).toBe("2h 05m");
  });

  it("normalizes negative, fractional and non-finite values", () => {
    expect(formatMinutes(-10)).toBe("0m");
    expect(formatMinutes(12.6)).toBe("13m");
    expect(formatMinutes(Number.NaN)).toBe("0m");
  });
});

describe("formatDrive", () => {
  it("adds the distance in miles when it is resolved", () => {
    expect(formatDrive(12, 4.1)).toBe("12m (4.1 mi)");
  });

  it("falls back to minutes only when there is no distance", () => {
    expect(formatDrive(12, null)).toBe("12m");
  });

  it("uses the hour format for long legs, so it does not read as metres", () => {
    expect(formatDrive(10939, 4280.33)).toBe("182h 19m (4280.33 mi)");
  });
});

describe("alignDateToPlanWeekday", () => {
  it("keeps the date when it already falls on the plan weekday", () => {
    // 2026-09-18 es viernes (weekday 5).
    expect(alignDateToPlanWeekday("2026-09-18", 5)).toBe("2026-09-18");
  });

  it("jumps forward to the next day of the plan", () => {
    expect(alignDateToPlanWeekday("2026-09-18", 1)).toBe("2026-09-21");
    expect(alignDateToPlanWeekday("2026-09-18", 6)).toBe("2026-09-19");
  });

  it("keeps the date when there is no plan or the date is invalid", () => {
    expect(alignDateToPlanWeekday("2026-09-18", null)).toBe("2026-09-18");
    expect(alignDateToPlanWeekday("not-a-date", 1)).toBe("not-a-date");
  });
});

describe("buildCalendarHref", () => {
  it("points at the month of the route and highlights the job", () => {
    expect(buildCalendarHref("2026-09-18", "job-1")).toBe(
      "/admin/routes?month=2026-09&highlight=job-1"
    );
  });

  it("omits the highlight when nothing was applied", () => {
    expect(buildCalendarHref("2026-09-18")).toBe("/admin/routes?month=2026-09");
  });
});

describe("countActiveStops", () => {
  const stops = [
    makeStop({ jobId: "a", status: "ON_THE_WAY" }),
    makeStop({ jobId: "b", status: "IN_PROGRESS" }),
    makeStop({ jobId: "c", status: "SCHEDULED" }),
  ];

  it("counts only the affected jobs that are already under way", () => {
    expect(countActiveStops(stops, ["a", "c"])).toBe(1);
    expect(countActiveStops(stops, ["a", "b"])).toBe(2);
  });

  it("returns zero when no job is affected", () => {
    expect(countActiveStops(stops, [])).toBe(0);
  });
});

describe("countDriveSources", () => {
  it("groups the stops by the origin of their travel time", () => {
    expect(
      countDriveSources([
        makeStop({ jobId: "a", driveSource: "LIVE_TRAFFIC" }),
        makeStop({ jobId: "b", driveSource: "ESTIMATED" }),
        makeStop({ jobId: "c", driveSource: "SAME_ADDRESS" }),
        makeStop({ jobId: "d", driveSource: "LIVE_TRAFFIC" }),
        makeStop({ jobId: "e" }),
      ])
    ).toEqual({ live: 2, estimated: 1, sameAddress: 1 });
  });
});
