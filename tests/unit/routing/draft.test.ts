/**
 * Tests del borrador editable del asistente de rutas (`src/lib/routing/draft.ts`).
 *
 * Fábrica de datos: 2 técnicos (Ana, Bruno) y 5 trabajos con el estado en base
 * de datos que usaría la interfaz (`currentTechnicianId` / `currentSortOrder`):
 * job-1..job-3 son de Ana (posiciones 10/20/30), job-4 de Bruno (10) y job-5
 * no tiene técnico asignado, así que el plan lo devuelve en `unassigned`.
 */
import { describe, expect, it } from "vitest";
import type {
  AssistantPlan,
  AssistantRoute,
  AssistantStop,
} from "@/lib/routing/assistant-types";
import {
  applyRecalculatedPlan,
  canUndo,
  createDraft,
  diffDraft,
  isDirty,
  lastUndoLabel,
  moveStop,
  moveStopToRoute,
  removeStop,
  resetDraft,
  restoreStop,
  toRecalculateRequest,
  toUpdates,
  undo,
  type Draft,
  type DraftRoute,
  type DraftStop,
  type DraftTechnician,
} from "@/lib/routing/draft";

const ORIGIN_ADDRESS = "10731 SW 147th Ct, Miami, FL 33196";
const ANA: DraftTechnician = { id: "tech-ana", name: "Ana Pérez" };
const BRUNO: DraftTechnician = { id: "tech-bruno", name: "Bruno Díaz" };
const TECHNICIANS: DraftTechnician[] = [ANA, BRUNO];

function makeStop(jobId: string, overrides: Partial<AssistantStop> = {}): DraftStop {
  return {
    jobId,
    customerName: `Cliente ${jobId}`,
    address: `${jobId} SW 100th St, Miami, FL`,
    propertyId: `property-${jobId}`,
    propertyName: null,
    planName: "Plan semanal",
    routeGroupId: null,
    routeGroupLabel: null,
    technicianId: "",
    technicianName: "",
    order: 0,
    scheduledTime: "09:00",
    estimatedArrivalTime: "09:00",
    serviceStartTime: "09:00",
    estimatedDriveMinutesFromPrevious: 12,
    estimatedServiceMinutes: 45,
    distanceMilesFromPrevious: 3.4,
    delayMinutes: null,
    driveSource: "ESTIMATED",
    status: "SCHEDULED",
    currentTechnicianId: null,
    currentTechnicianName: null,
    currentSortOrder: null,
    hasCoordinates: true,
    ...overrides,
  };
}

/** Paradas tal y como las devuelve el plan: con técnico y posición 1-based. */
function routeStops(technician: DraftTechnician, stops: readonly DraftStop[]): DraftStop[] {
  return stops.map((stop, index) => ({
    ...stop,
    technicianId: technician.id,
    technicianName: technician.name,
    order: index + 1,
  }));
}

function makeRoute(technician: DraftTechnician, stops: readonly DraftStop[]): AssistantRoute {
  return {
    technicianId: technician.id,
    technicianName: technician.name,
    originAddress: ORIGIN_ADDRESS,
    routeGroupIds: [],
    routeGroupLabels: [],
    stops: routeStops(technician, stops),
    totalDriveMinutes: 36,
    returnDriveMinutes: 14,
    totalServiceMinutes: stops.length * 45,
    totalRouteMinutes: 140,
    returnDistanceMiles: 5.2,
    estimatedReturnTime: "15:30",
    conflicts: 0,
  };
}

function makePlan(
  routes: readonly AssistantRoute[],
  unassigned: readonly DraftStop[] = [],
): AssistantPlan {
  const totalStops = routes.reduce((total, route) => total + route.stops.length, 0);
  return {
    strategy: "SHORT_DRIVE",
    routes,
    unassigned,
    summary: {
      totalStops,
      totalDriveMinutes: 72,
      totalServiceMinutes: totalStops * 45,
      totalRouteMinutes: 280,
      conflicts: 0,
      loadSpread: 2,
    },
    updates: [],
  };
}

const JOB_1 = makeStop("job-1", {
  serviceStartTime: "08:30",
  currentTechnicianId: ANA.id,
  currentTechnicianName: ANA.name,
  currentSortOrder: 10,
});
const JOB_2 = makeStop("job-2", {
  serviceStartTime: "09:15",
  currentTechnicianId: ANA.id,
  currentTechnicianName: ANA.name,
  currentSortOrder: 20,
});
const JOB_3 = makeStop("job-3", {
  serviceStartTime: "10:00",
  currentTechnicianId: ANA.id,
  currentTechnicianName: ANA.name,
  currentSortOrder: 30,
});
const JOB_4 = makeStop("job-4", {
  serviceStartTime: "08:45",
  currentTechnicianId: BRUNO.id,
  currentTechnicianName: BRUNO.name,
  currentSortOrder: 10,
});
const JOB_5 = makeStop("job-5", { serviceStartTime: "" });

/** Propuesta que coincide con el estado en base de datos. */
function makeBasePlan(): AssistantPlan {
  return makePlan(
    [makeRoute(ANA, [JOB_1, JOB_2, JOB_3]), makeRoute(BRUNO, [JOB_4])],
    [JOB_5],
  );
}

function makeBaseDraft(): Draft {
  return createDraft(makeBasePlan(), TECHNICIANS);
}

function jobIdsByRoute(draft: Draft): string[][] {
  return draft.routes.map((route) => route.stops.map((stop) => stop.jobId));
}

function ordersOf(route: DraftRoute): number[] {
  return route.stops.map((stop) => stop.order);
}

describe("createDraft", () => {
  it("creates one route per technician in the received order", () => {
    // Arrange
    const plan = makeBasePlan();

    // Act
    const draft = createDraft(plan, [BRUNO, ANA]);

    // Assert
    expect(draft.routes.map((route) => route.technicianId)).toEqual([BRUNO.id, ANA.id]);
    expect(draft.routes.map((route) => route.technicianName)).toEqual([BRUNO.name, ANA.name]);
    expect(jobIdsByRoute(draft)).toEqual([["job-4"], ["job-1", "job-2", "job-3"]]);
  });

  it("leaves an empty route for a technician without stops in the plan", () => {
    // Arrange
    const plan = makePlan([makeRoute(ANA, [JOB_1, JOB_2, JOB_3])]);

    // Act
    const draft = createDraft(plan, TECHNICIANS);

    // Assert
    expect(draft.routes).toHaveLength(2);
    expect(draft.routes[1].stops).toEqual([]);
  });

  it("moves the unassigned stops of the plan into removed without technician", () => {
    // Arrange
    const plan = makeBasePlan();

    // Act
    const draft = createDraft(plan, TECHNICIANS);

    // Assert
    expect(draft.removed.map((stop) => stop.jobId)).toEqual(["job-5"]);
    expect(draft.removed[0].technicianId).toBe("");
    expect(draft.removed[0].technicianName).toBe("");
    expect(draft.removed[0].order).toBe(0);
  });

  it("copies the initial routes and removed into baseline with an empty history", () => {
    // Arrange & Act
    const draft = makeBaseDraft();

    // Assert
    expect(draft.baseline.routes).toEqual(draft.routes);
    expect(draft.baseline.routes).not.toBe(draft.routes);
    expect(draft.baseline.removed).toEqual(draft.removed);
    expect(draft.baseline.removed).not.toBe(draft.removed);
    expect(draft.history).toEqual([]);
    expect(canUndo(draft)).toBe(false);
    expect(isDirty(draft)).toBe(false);
  });

  it("numbers the stops of every route from one", () => {
    // Arrange & Act
    const draft = makeBaseDraft();

    // Assert
    expect(ordersOf(draft.routes[0])).toEqual([1, 2, 3]);
    expect(ordersOf(draft.routes[1])).toEqual([1]);
  });
});

describe("moveStop", () => {
  it("moves a stop up and renumbers the route", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStop(draft, "job-2", -1);

    // Assert
    expect(jobIdsByRoute(moved)[0]).toEqual(["job-2", "job-1", "job-3"]);
    expect(ordersOf(moved.routes[0])).toEqual([1, 2, 3]);
  });

  it("moves a stop down and renumbers the route", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStop(draft, "job-1", 1);

    // Assert
    expect(jobIdsByRoute(moved)[0]).toEqual(["job-2", "job-1", "job-3"]);
    expect(moved.routes[0].stops[1].order).toBe(2);
  });

  it("keeps the arrival times untouched so the UI can mark them as stale", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStop(draft, "job-1", 1);

    // Assert
    expect(moved.routes[0].stops[1].estimatedArrivalTime).toBe(JOB_1.estimatedArrivalTime);
    expect(moved.routes[0].stops[1].serviceStartTime).toBe("08:30");
    expect(moved.routes[0].stops[1].distanceMilesFromPrevious).toBe(JOB_1.distanceMilesFromPrevious);
  });

  it("returns the same draft without history when moving the first stop up", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStop(draft, "job-1", -1);

    // Assert
    expect(moved).toBe(draft);
    expect(moved.history).toHaveLength(0);
  });

  it("returns the same draft without history when moving the last stop down", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStop(draft, "job-3", 1);

    // Assert
    expect(moved).toBe(draft);
    expect(moved.history).toHaveLength(0);
  });

  it("returns the same draft when the job is not inside any route", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStop(draft, "job-5", 1);

    // Assert
    expect(moved).toBe(draft);
  });

  it("pushes the previous state with a move label", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStop(draft, "job-1", 1);

    // Assert
    expect(moved.history).toHaveLength(1);
    expect(moved.history[0].routes).toEqual(draft.routes);
    expect(lastUndoLabel(moved)).toBe("move:job-1");
  });
});

describe("moveStopToRoute", () => {
  it("appends the stop at the end of the target route by default", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStopToRoute(draft, "job-1", BRUNO.id);

    // Assert
    expect(jobIdsByRoute(moved)).toEqual([["job-2", "job-3"], ["job-4", "job-1"]]);
    expect(moved.routes[1].stops[1].technicianId).toBe(BRUNO.id);
    expect(moved.routes[1].stops[1].technicianName).toBe(BRUNO.name);
    expect(ordersOf(moved.routes[1])).toEqual([1, 2]);
    expect(ordersOf(moved.routes[0])).toEqual([1, 2]);
  });

  it("inserts the stop at the given index of the target route", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStopToRoute(draft, "job-1", BRUNO.id, 0);

    // Assert
    expect(jobIdsByRoute(moved)[1]).toEqual(["job-1", "job-4"]);
    expect(moved.routes[1].stops[0].order).toBe(1);
    expect(lastUndoLabel(moved)).toBe("reassign:job-1");
  });

  it("clamps an index beyond the target route length", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStopToRoute(draft, "job-1", BRUNO.id, 99);

    // Assert
    expect(jobIdsByRoute(moved)[1]).toEqual(["job-4", "job-1"]);
  });

  it("reorders inside the same route when the target technician is the current one", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStopToRoute(draft, "job-1", ANA.id, 2);

    // Assert
    expect(jobIdsByRoute(moved)[0]).toEqual(["job-2", "job-3", "job-1"]);
    expect(ordersOf(moved.routes[0])).toEqual([1, 2, 3]);
  });

  it("returns the same draft when the technician does not exist", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStopToRoute(draft, "job-1", "tech-ghost");

    // Assert
    expect(moved).toBe(draft);
    expect(moved.history).toHaveLength(0);
  });

  it("returns the same draft when the job is excluded instead of routed", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const moved = moveStopToRoute(draft, "job-5", BRUNO.id);

    // Assert
    expect(moved).toBe(draft);
  });

  it("returns the same draft when the stop would land on its current position", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const sameIndex = moveStopToRoute(draft, "job-1", ANA.id, 0);
    const lastByDefault = moveStopToRoute(draft, "job-3", ANA.id);

    // Assert
    expect(sameIndex).toBe(draft);
    expect(lastByDefault).toBe(draft);
  });
});

describe("removeStop and restoreStop", () => {
  it("removes a stop from its route, renumbers it and appends it to removed", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const next = removeStop(draft, "job-1");

    // Assert
    expect(jobIdsByRoute(next)[0]).toEqual(["job-2", "job-3"]);
    expect(ordersOf(next.routes[0])).toEqual([1, 2]);
    expect(next.removed.map((stop) => stop.jobId)).toEqual(["job-5", "job-1"]);
    expect(next.removed[1].technicianId).toBe("");
    expect(lastUndoLabel(next)).toBe("remove:job-1");
  });

  it("returns the same draft when removing a job that is not routed", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const next = removeStop(draft, "job-unknown");

    // Assert
    expect(next).toBe(draft);
    expect(next.history).toHaveLength(0);
  });

  it("restores a removed stop at the end of the chosen route by default", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const next = restoreStop(draft, "job-5", ANA.id);

    // Assert
    expect(jobIdsByRoute(next)[0]).toEqual(["job-1", "job-2", "job-3", "job-5"]);
    expect(next.removed).toEqual([]);
    expect(next.routes[0].stops[3].technicianId).toBe(ANA.id);
    expect(next.routes[0].stops[3].technicianName).toBe(ANA.name);
    expect(next.routes[0].stops[3].order).toBe(4);
    expect(lastUndoLabel(next)).toBe("restore:job-5");
  });

  it("restores a removed stop at the given index", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const next = restoreStop(draft, "job-5", ANA.id, 1);

    // Assert
    expect(jobIdsByRoute(next)[0]).toEqual(["job-1", "job-5", "job-2", "job-3"]);
    expect(ordersOf(next.routes[0])).toEqual([1, 2, 3, 4]);
  });

  it("returns the same draft when restoring into an unknown technician", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const next = restoreStop(draft, "job-5", "tech-ghost");

    // Assert
    expect(next).toBe(draft);
  });

  it("returns the same draft when restoring a job that is not excluded", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const next = restoreStop(draft, "job-1", BRUNO.id);

    // Assert
    expect(next).toBe(draft);
  });
});

describe("undo, resetDraft and isDirty", () => {
  it("undoes several levels back to the initial state", () => {
    // Arrange
    const draft = makeBaseDraft();
    const edited = removeStop(moveStopToRoute(moveStop(draft, "job-1", 1), "job-3", BRUNO.id), "job-4");

    // Act
    const restored = undo(undo(undo(edited)));

    // Assert
    expect(edited.history).toHaveLength(3);
    expect(restored.routes).toEqual(draft.routes);
    expect(restored.removed).toEqual(draft.removed);
    expect(restored.history).toEqual([]);
    expect(isDirty(restored)).toBe(false);
  });

  it("undoes one level at a time reporting the label of the last action", () => {
    // Arrange
    const draft = makeBaseDraft();
    const edited = removeStop(moveStop(draft, "job-1", 1), "job-2");

    // Act
    const once = undo(edited);

    // Assert
    expect(lastUndoLabel(edited)).toBe("remove:job-2");
    expect(jobIdsByRoute(once)[0]).toEqual(["job-2", "job-1", "job-3"]);
    expect(lastUndoLabel(once)).toBe("move:job-1");
    expect(canUndo(once)).toBe(true);
  });

  it("keeps at most 30 snapshots discarding the oldest", () => {
    // Arrange
    const draft = makeBaseDraft();
    const deltas: Array<-1 | 1> = Array.from({ length: 35 }, (_, index) => (index % 2 === 0 ? 1 : -1));
    const applyMoves = (count: number): Draft =>
      deltas.slice(0, count).reduce((current, delta) => moveStop(current, "job-1", delta), draft);

    // Act
    const edited = applyMoves(35);

    // Assert
    expect(edited.history).toHaveLength(30);
    expect(edited.history.every((snapshot) => snapshot.label === "move:job-1")).toBe(true);
    expect(edited.history[0].routes).toEqual(applyMoves(5).routes);
  });

  it("returns the same draft when there is nothing to undo", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const next = undo(draft);

    // Assert
    expect(next).toBe(draft);
    expect(lastUndoLabel(draft)).toBeNull();
    expect(canUndo(draft)).toBe(false);
  });

  it("resets to the baseline and clears the history", () => {
    // Arrange
    const draft = makeBaseDraft();
    const edited = removeStop(moveStop(draft, "job-1", 1), "job-4");

    // Act
    const reset = resetDraft(edited);

    // Assert
    expect(reset.routes).toEqual(draft.baseline.routes);
    expect(reset.removed).toEqual(draft.baseline.removed);
    expect(reset.history).toEqual([]);
    expect(isDirty(reset)).toBe(false);
  });

  it("reports a dirty draft after an edit and a clean one after undoing it", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const edited = moveStopToRoute(draft, "job-1", BRUNO.id);

    // Assert
    expect(isDirty(draft)).toBe(false);
    expect(isDirty(edited)).toBe(true);
    expect(isDirty(undo(edited))).toBe(false);
  });

  it("reports a dirty draft when a stop is excluded", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const edited = removeStop(draft, "job-4");

    // Assert
    expect(isDirty(edited)).toBe(true);
  });
});

describe("diffDraft", () => {
  it("reports no changes when the proposal matches the database", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const diff = diffDraft(draft);

    // Assert
    expect(diff).toEqual({ changes: [], reordered: 0, reassigned: 0, removed: 0, total: 0 });
  });

  it("reports order changes against the current database positions", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const diff = diffDraft(moveStop(draft, "job-1", 1));

    // Assert
    expect(diff.changes).toEqual([
      { kind: "order", jobId: "job-2", technicianId: ANA.id, from: 2, to: 1 },
      { kind: "order", jobId: "job-1", technicianId: ANA.id, from: 1, to: 2 },
    ]);
    expect(diff).toMatchObject({ reordered: 2, reassigned: 0, removed: 0, total: 2 });
  });

  it("reports a technician change and never counts it as reordered", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const diff = diffDraft(moveStopToRoute(draft, "job-1", BRUNO.id));

    // Assert
    expect(diff.changes.filter((change) => change.jobId === "job-1")).toEqual([
      { kind: "technician", jobId: "job-1", from: ANA.id, to: BRUNO.id },
    ]);
    expect(diff).toMatchObject({ reassigned: 1, reordered: 2, removed: 0, total: 3 });
  });

  it("reports a technician change with a null origin for a job without technician", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const diff = diffDraft(restoreStop(draft, "job-5", BRUNO.id));

    // Assert
    expect(diff.changes).toEqual([
      { kind: "technician", jobId: "job-5", from: null, to: BRUNO.id },
    ]);
    expect(diff).toMatchObject({ reassigned: 1, removed: 0, total: 1 });
  });

  it("reports a removed change only for excluded stops that had a technician", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const diff = diffDraft(removeStop(draft, "job-1"));

    // Assert
    expect(diff.changes).toContainEqual({ kind: "removed", jobId: "job-1" });
    expect(diff.changes.some((change) => change.jobId === "job-5")).toBe(false);
    expect(diff).toMatchObject({ removed: 1, reordered: 2, reassigned: 0, total: 3 });
  });

  it("counts excluded stops as occupying their database position", () => {
    // Arrange: al excluir la última parada, las anteriores no se mueven en BD.
    const draft = makeBaseDraft();

    // Act
    const diff = diffDraft(removeStop(draft, "job-3"));

    // Assert
    expect(diff.changes).toEqual([{ kind: "removed", jobId: "job-3" }]);
    expect(diff.total).toBe(1);
  });

  it("breaks ties of the current database order by job id", () => {
    // Arrange: job-2 y job-3 comparten currentSortOrder, así que job-2 va antes.
    const tied = makePlan([
      makeRoute(ANA, [
        JOB_3,
        { ...JOB_2, currentSortOrder: 30 },
        JOB_1,
      ]),
    ]);
    const draft = createDraft(tied, [ANA]);

    // Act
    const diff = diffDraft(draft);

    // Assert: job-2 conserva su posición 2, así que no genera cambio.
    expect(diff.changes).toEqual([
      { kind: "order", jobId: "job-3", technicianId: ANA.id, from: 3, to: 1 },
      { kind: "order", jobId: "job-1", technicianId: ANA.id, from: 1, to: 3 },
    ]);
    expect(diff.reordered).toBe(2);
  });
});

describe("toUpdates", () => {
  it("uses the minute of the day of serviceStartTime ordered by route and position", () => {
    // Arrange
    const draft = makeBaseDraft();

    // Act
    const updates = toUpdates(draft);

    // Assert
    expect(updates).toEqual([
      { jobId: "job-1", technicianId: ANA.id, sortOrder: 510 },
      { jobId: "job-2", technicianId: ANA.id, sortOrder: 555 },
      { jobId: "job-3", technicianId: ANA.id, sortOrder: 600 },
      { jobId: "job-4", technicianId: BRUNO.id, sortOrder: 525 },
    ]);
  });

  it("adds a tie index when stops of the same route share the service start time", () => {
    // Arrange
    const plan = makePlan([
      makeRoute(ANA, [
        { ...JOB_1, serviceStartTime: "09:00" },
        { ...JOB_2, serviceStartTime: "09:00" },
        { ...JOB_3, serviceStartTime: "09:00" },
      ]),
      makeRoute(BRUNO, [{ ...JOB_4, serviceStartTime: "09:00" }]),
    ]);

    // Act
    const updates = toUpdates(createDraft(plan, TECHNICIANS));

    // Assert
    expect(updates.map((update) => update.sortOrder)).toEqual([540, 541, 542, 540]);
  });

  it("falls back to a ten minute step when serviceStartTime is missing or invalid", () => {
    // Arrange
    const plan = makePlan([
      makeRoute(ANA, [
        { ...JOB_1, serviceStartTime: "" },
        { ...JOB_2, serviceStartTime: "24:00" },
        { ...JOB_3, serviceStartTime: "9am" },
      ]),
    ]);

    // Act
    const updates = toUpdates(createDraft(plan, [ANA]));

    // Assert
    expect(updates.map((update) => update.sortOrder)).toEqual([10, 20, 30]);
  });

  it("mixes parsed times and fallbacks inside the same route", () => {
    // Arrange
    const plan = makePlan([
      makeRoute(ANA, [
        { ...JOB_1, serviceStartTime: "09:00" },
        { ...JOB_2, serviceStartTime: "" },
        { ...JOB_3, serviceStartTime: "09:00" },
      ]),
    ]);

    // Act
    const updates = toUpdates(createDraft(plan, [ANA]));

    // Assert
    expect(updates.map((update) => update.sortOrder)).toEqual([540, 20, 541]);
  });

  it("ignores the excluded stops", () => {
    // Arrange
    const draft = removeStop(makeBaseDraft(), "job-1");

    // Act
    const updates = toUpdates(draft);

    // Assert
    expect(updates.map((update) => update.jobId)).toEqual(["job-2", "job-3", "job-4"]);
  });
});

describe("toRecalculateRequest", () => {
  it("maps every non empty route to its job ids in order", () => {
    // Arrange
    const draft = moveStopToRoute(makeBaseDraft(), "job-4", ANA.id, 0);

    // Act
    const request = toRecalculateRequest(draft, "2026-09-21");

    // Assert
    expect(request).toEqual({
      date: "2026-09-21",
      routes: [{ technicianId: ANA.id, jobIds: ["job-4", "job-1", "job-2", "job-3"] }],
    });
  });
});

describe("applyRecalculatedPlan", () => {
  it("replaces the stops of each route keeping removed, baseline and history", () => {
    // Arrange
    const draft = removeStop(makeBaseDraft(), "job-2");
    const recalculated = makePlan([
      makeRoute(ANA, [
        { ...JOB_3, serviceStartTime: "08:20", estimatedArrivalTime: "08:20" },
        { ...JOB_1, serviceStartTime: "09:40", estimatedArrivalTime: "09:40" },
      ]),
      makeRoute(BRUNO, [{ ...JOB_4, serviceStartTime: "08:10" }]),
    ]);

    // Act
    const next = applyRecalculatedPlan(draft, recalculated);

    // Assert
    expect(jobIdsByRoute(next)).toEqual([["job-3", "job-1"], ["job-4"]]);
    expect(next.routes[0].stops[0].serviceStartTime).toBe("08:20");
    expect(ordersOf(next.routes[0])).toEqual([1, 2]);
    expect(next.routes[0].stops[1].technicianId).toBe(ANA.id);
    expect(next.removed).toBe(draft.removed);
    expect(next.baseline).toBe(draft.baseline);
    expect(next.history).toBe(draft.history);
  });

  it("keeps the current stops of a route missing from the recalculated plan", () => {
    // Arrange
    const draft = makeBaseDraft();
    const recalculated = makePlan([makeRoute(ANA, [JOB_2, JOB_1, JOB_3])]);

    // Act
    const next = applyRecalculatedPlan(draft, recalculated);

    // Assert
    expect(jobIdsByRoute(next)).toEqual([["job-2", "job-1", "job-3"], ["job-4"]]);
    expect(next.routes[1]).toBe(draft.routes[1]);
  });
});

describe("immutability", () => {
  it("does not modify the plan nor the technician list given to createDraft", () => {
    // Arrange
    const plan = makeBasePlan();
    const technicians = [ANA, BRUNO];
    const planSnapshot = structuredClone(plan);
    const techniciansSnapshot = structuredClone(technicians);

    // Act
    const draft = createDraft(plan, technicians);
    removeStop(moveStop(draft, "job-1", 1), "job-3");

    // Assert
    expect(plan).toEqual(planSnapshot);
    expect(technicians).toEqual(techniciansSnapshot);
  });

  it("does not modify the previous draft when editing it", () => {
    // Arrange
    const draft = makeBaseDraft();
    const snapshot = structuredClone(draft);

    // Act
    const edited = restoreStop(
      removeStop(moveStopToRoute(moveStop(draft, "job-1", 1), "job-2", BRUNO.id), "job-3"),
      "job-5",
      ANA.id,
    );

    // Assert
    expect(draft).toEqual(snapshot);
    expect(edited).not.toBe(draft);
    expect(edited.routes).not.toBe(draft.routes);
  });

  it("does not modify the draft when reading it", () => {
    // Arrange
    const draft = removeStop(makeBaseDraft(), "job-1");
    const snapshot = structuredClone(draft);

    // Act
    diffDraft(draft);
    toUpdates(draft);
    toRecalculateRequest(draft, "2026-09-21");
    isDirty(draft);
    lastUndoLabel(draft);

    // Assert
    expect(draft).toEqual(snapshot);
  });
});
