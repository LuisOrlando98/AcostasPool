/**
 * Tests de src/lib/routing/tour.ts: orden de visita que minimiza el circuito
 * cerrado base → paradas → base. El óptimo se contrasta con fuerza bruta.
 */
import { describe, expect, it } from "vitest";
import {
  EXACT_TOUR_MAX_STOPS,
  optimizeTourOrder,
  tourCost,
  type CostMatrix,
} from "@/lib/routing/tour";

type Point = { x: number; y: number };

const BASE: Point = { x: 0, y: 0 };

/** Generador pseudoaleatorio determinista (LCG): mismos puntos en cada ejecución. */
function seededPoints(count: number, seed: number): Point[] {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return Array.from({ length: count }, () => ({ x: next() * 100, y: next() * 100 }));
}

function euclideanMatrix(stops: readonly Point[]): number[][] {
  const nodes = [BASE, ...stops];
  return nodes.map((from) =>
    nodes.map((to) => Math.hypot(from.x - to.x, from.y - to.y))
  );
}

function circleStops(count: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * (index + 1)) / (count + 1);
    return { x: 50 * Math.cos(angle) - 50, y: 50 * Math.sin(angle) };
  });
}

function permutations(items: readonly number[]): number[][] {
  if (items.length <= 1) {
    return [[...items]];
  }
  return items.flatMap((item, index) =>
    permutations(items.filter((_, other) => other !== index)).map((rest) => [item, ...rest])
  );
}

function bruteForceCost(costs: CostMatrix, stopCount: number): number {
  const stops = Array.from({ length: stopCount }, (_, index) => index + 1);
  return Math.min(...permutations(stops).map((order) => tourCost(costs, order)));
}

function nearestNeighborCost(costs: CostMatrix, stopCount: number): number {
  const pending = new Set(Array.from({ length: stopCount }, (_, index) => index + 1));
  const order: number[] = [];
  let current = 0;
  while (pending.size > 0) {
    const next = [...pending].reduce((best, candidate) =>
      costs[current][candidate] < costs[current][best] ? candidate : best
    );
    order.push(next);
    pending.delete(next);
    current = next;
  }
  return tourCost(costs, order);
}

describe("tourCost", () => {
  it("suma la salida de la base, los tramos intermedios y el regreso", () => {
    const costs = [
      [0, 10, 20],
      [11, 0, 5],
      [21, 6, 0],
    ];

    expect(tourCost(costs, [1, 2])).toBe(10 + 5 + 21);
    expect(tourCost(costs, [2, 1])).toBe(20 + 6 + 11);
  });

  it("vale 0 sin paradas", () => {
    expect(tourCost([[0]], [])).toBe(0);
  });
});

describe("optimizeTourOrder: casos límite", () => {
  it("devuelve una lista vacía sin paradas", () => {
    expect(optimizeTourOrder([[0]], 0)).toEqual([]);
  });

  it("con una parada devuelve esa parada", () => {
    expect(optimizeTourOrder([[0, 7], [7, 0]], 1)).toEqual([1]);
  });

  it("devuelve cada parada exactamente una vez", () => {
    const costs = euclideanMatrix(seededPoints(9, 3));

    const order = optimizeTourOrder(costs, 9);

    expect([...order].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("optimizeTourOrder: óptimo exacto", () => {
  it.each([2, 3, 5, 7, 8])("iguala a la fuerza bruta con %i paradas", (stopCount) => {
    const costs = euclideanMatrix(seededPoints(stopCount, 11 + stopCount));

    const order = optimizeTourOrder(costs, stopCount);

    expect(tourCost(costs, order)).toBeCloseTo(bruteForceCost(costs, stopCount), 9);
  });

  it("tiene en cuenta el regreso a la base, no solo el tramo siguiente", () => {
    // Desde la base, 1 es la parada más cercana, pero volver desde 2 es carísimo:
    // el vecino más cercano hace base→1→2→base (1 + 1 + 50); el óptimo, 2→1.
    const costs = [
      [0, 1, 2],
      [1, 0, 1],
      [50, 1, 0],
    ];

    expect(optimizeTourOrder(costs, 2)).toEqual([2, 1]);
  });

  it("respeta matrices asimétricas (tráfico distinto en cada sentido)", () => {
    const costs = [
      [0, 5, 5, 5],
      [5, 0, 1, 30],
      [5, 30, 0, 1],
      [5, 1, 30, 0],
    ];

    const order = optimizeTourOrder(costs, 3);

    expect(tourCost(costs, order)).toBe(bruteForceCost(costs, 3));
    expect(tourCost(costs, order)).toBe(12);
  });

  it("a igualdad de coste empieza por la parada más cercana a la base", () => {
    // Rectángulo con la base en una esquina: rodearlo cuesta lo mismo en los dos
    // sentidos, pero la parada 3 queda a 10 de la base y la 1 a 20.
    const costs = euclideanMatrix([
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ]);

    expect(optimizeTourOrder(costs, 3)).toEqual([3, 2, 1]);
  });

  it("es exacto hasta el límite EXACT_TOUR_MAX_STOPS", () => {
    // Paradas sobre una circunferencia que pasa por la base: el óptimo conocido
    // es recorrerla en orden.
    const costs = euclideanMatrix(circleStops(EXACT_TOUR_MAX_STOPS));
    const inOrder = Array.from({ length: EXACT_TOUR_MAX_STOPS }, (_, index) => index + 1);

    const order = optimizeTourOrder(costs, EXACT_TOUR_MAX_STOPS);

    expect(tourCost(costs, order)).toBeCloseTo(tourCost(costs, inOrder), 9);
  });
});

describe("optimizeTourOrder: rutas largas (heurística)", () => {
  const LONG_ROUTE_STOPS = 30;

  it("visita todas las paradas una vez", () => {
    const costs = euclideanMatrix(seededPoints(LONG_ROUTE_STOPS, 5));

    const order = optimizeTourOrder(costs, LONG_ROUTE_STOPS);

    expect(new Set(order).size).toBe(LONG_ROUTE_STOPS);
    expect(order).toHaveLength(LONG_ROUTE_STOPS);
  });

  it.each([5, 17, 42])("nunca es peor que el vecino más cercano (semilla %i)", (seed) => {
    const costs = euclideanMatrix(seededPoints(LONG_ROUTE_STOPS, seed));

    const order = optimizeTourOrder(costs, LONG_ROUTE_STOPS);

    expect(tourCost(costs, order)).toBeLessThanOrEqual(
      nearestNeighborCost(costs, LONG_ROUTE_STOPS)
    );
  });

  it("deshace los cruces de un recorrido en circunferencia", () => {
    const costs = euclideanMatrix(circleStops(LONG_ROUTE_STOPS));
    const inOrder = Array.from({ length: LONG_ROUTE_STOPS }, (_, index) => index + 1);

    const order = optimizeTourOrder(costs, LONG_ROUTE_STOPS);

    expect(tourCost(costs, order)).toBeCloseTo(tourCost(costs, inOrder), 6);
  });

  it("es determinista", () => {
    const costs = euclideanMatrix(seededPoints(LONG_ROUTE_STOPS, 9));

    expect(optimizeTourOrder(costs, LONG_ROUTE_STOPS)).toEqual(
      optimizeTourOrder(costs, LONG_ROUTE_STOPS)
    );
  });
});
