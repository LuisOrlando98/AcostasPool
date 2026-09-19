import { describe, expect, it } from "vitest";
import {
  insertionIndex,
  resolveDropIndex,
  zoneAt,
  type RowBounds,
  type ZoneBounds,
} from "@/components/routes/assistant/drag-index";

/** Tres filas de 40 px con 10 px de separación: 0-40, 50-90, 100-140. */
const rows: readonly RowBounds[] = [
  { top: 0, bottom: 40 },
  { top: 50, bottom: 90 },
  { top: 100, bottom: 140 },
];

describe("insertionIndex", () => {
  it("inserts before the first row while the pointer is above its midpoint", () => {
    expect(insertionIndex(rows, -20)).toBe(0);
    expect(insertionIndex(rows, 0)).toBe(0);
    expect(insertionIndex(rows, 19)).toBe(0);
  });

  it("inserts after a row once the pointer passes its midpoint", () => {
    expect(insertionIndex(rows, 20)).toBe(1);
    expect(insertionIndex(rows, 45)).toBe(1);
    expect(insertionIndex(rows, 69)).toBe(1);
  });

  it("inserts between the second and third rows", () => {
    expect(insertionIndex(rows, 70)).toBe(2);
    expect(insertionIndex(rows, 119)).toBe(2);
  });

  it("appends at the end below the last midpoint", () => {
    expect(insertionIndex(rows, 120)).toBe(3);
    expect(insertionIndex(rows, 9999)).toBe(3);
  });

  it("returns 0 for an empty route", () => {
    expect(insertionIndex([], 500)).toBe(0);
  });
});

describe("resolveDropIndex", () => {
  it("keeps the index when the stop comes from another route", () => {
    expect(resolveDropIndex(0, null)).toBe(0);
    expect(resolveDropIndex(3, null)).toBe(3);
  });

  it("keeps the index when dropping above the dragged row", () => {
    expect(resolveDropIndex(0, 2)).toBe(0);
    expect(resolveDropIndex(2, 2)).toBe(2);
  });

  it("discounts the dragged row when dropping below it", () => {
    expect(resolveDropIndex(3, 2)).toBe(2);
    expect(resolveDropIndex(5, 1)).toBe(4);
  });

  it("turns both neighbouring positions of the dragged row into a no-op index", () => {
    expect(resolveDropIndex(1, 1)).toBe(1);
    expect(resolveDropIndex(2, 1)).toBe(1);
  });
});

const zones: readonly ZoneBounds[] = [
  { id: "tech-1", top: 0, bottom: 100, left: 0, right: 300 },
  { id: "tech-2", top: 120, bottom: 220, left: 0, right: 300 },
  { id: "__excluded__", top: 240, bottom: 300, left: 0, right: 300 },
];

describe("zoneAt", () => {
  it("returns the zone that contains the pointer", () => {
    expect(zoneAt(zones, 10, 50)).toBe("tech-1");
    expect(zoneAt(zones, 299, 200)).toBe("tech-2");
    expect(zoneAt(zones, 10, 250)).toBe("__excluded__");
  });

  it("accepts the edges of a zone", () => {
    expect(zoneAt(zones, 0, 0)).toBe("tech-1");
    expect(zoneAt(zones, 300, 100)).toBe("tech-1");
  });

  it("returns null in the gap between zones and outside them", () => {
    expect(zoneAt(zones, 10, 110)).toBeNull();
    expect(zoneAt(zones, 400, 50)).toBeNull();
    expect(zoneAt([], 10, 10)).toBeNull();
  });
});
