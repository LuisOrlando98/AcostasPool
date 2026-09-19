import { describe, expect, it } from "vitest";
import type { AssistantStop } from "@/lib/routing/assistant-types";
import {
  collectStops,
  countStopsWithoutCoordinates,
  findStopLocation,
  resolveRestoreTarget,
  summarizeRoute,
  summarizeRoutes,
  type RouteLike,
} from "@/components/routes/assistant/draft-view";

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
    estimatedDriveMinutesFromPrevious: 10,
    estimatedServiceMinutes: 30,
    distanceMilesFromPrevious: 2,
    delayMinutes: null,
    status: "SCHEDULED",
    currentTechnicianId: "tech-1",
    currentTechnicianName: "Tecnico Demo",
    currentSortOrder: 540,
    hasCoordinates: true,
    ...overrides,
  };
}

const routes: readonly RouteLike[] = [
  {
    technicianId: "tech-1",
    technicianName: "Ana",
    stops: [
      makeStop({ jobId: "a" }),
      makeStop({ jobId: "b", estimatedDriveMinutesFromPrevious: 20, delayMinutes: 40 }),
    ],
  },
  {
    technicianId: "tech-2",
    technicianName: "Luis",
    stops: [makeStop({ jobId: "c", hasCoordinates: false })],
  },
];

describe("collectStops", () => {
  it("flattens the stops of every route in order", () => {
    expect(collectStops(routes).map((stop) => stop.jobId)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty list when there are no routes", () => {
    expect(collectStops([])).toEqual([]);
  });
});

describe("findStopLocation", () => {
  it("returns the stop with its route and 1-based position", () => {
    const location = findStopLocation(routes, "b");

    expect(location?.position).toBe(2);
    expect(location?.route.technicianName).toBe("Ana");
    expect(location?.stop.jobId).toBe("b");
  });

  it("returns null for a job that is not in any route", () => {
    expect(findStopLocation(routes, "missing")).toBeNull();
  });
});

describe("summarizeRoute", () => {
  it("adds up the stops, drive and service of one route", () => {
    expect(summarizeRoute(routes[0])).toEqual({
      stops: 2,
      driveMinutes: 30,
      serviceMinutes: 60,
    });
  });
});

describe("summarizeRoutes", () => {
  it("counts a conflict only above the delay threshold", () => {
    expect(summarizeRoutes(routes)).toEqual({
      stops: 3,
      driveMinutes: 40,
      serviceMinutes: 90,
      conflicts: 1,
      withoutCoordinates: 1,
    });
  });

  it("returns zeros for an empty proposal", () => {
    expect(summarizeRoutes([])).toEqual({
      stops: 0,
      driveMinutes: 0,
      serviceMinutes: 0,
      conflicts: 0,
      withoutCoordinates: 0,
    });
  });
});

describe("countStopsWithoutCoordinates", () => {
  it("counts the stops whose address could not be geocoded", () => {
    expect(countStopsWithoutCoordinates(routes)).toBe(1);
  });
});

describe("resolveRestoreTarget", () => {
  it("prefers the technician the job has in the database", () => {
    const stop = makeStop({ currentTechnicianId: "tech-2", technicianId: "tech-1" });

    expect(resolveRestoreTarget(routes, stop)).toBe("tech-2");
  });

  it("falls back to the proposed technician when the current one is out of scope", () => {
    const stop = makeStop({ currentTechnicianId: "tech-9", technicianId: "tech-1" });

    expect(resolveRestoreTarget(routes, stop)).toBe("tech-1");
  });

  it("falls back to the first route, and to an empty id without routes", () => {
    const orphan = makeStop({ currentTechnicianId: null, technicianId: "" });

    expect(resolveRestoreTarget(routes, orphan)).toBe("tech-1");
    expect(resolveRestoreTarget([], orphan)).toBe("");
  });
});
