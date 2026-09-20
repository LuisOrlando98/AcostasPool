/**
 * Orden de visita que minimiza el recorrido de un circuito cerrado:
 * base → todas las paradas → base.
 *
 * Trabaja sobre una matriz de costes (minutos de conducción) donde el índice 0
 * es la base y 1..n son las paradas. La matriz puede ser asimétrica: con
 * tráfico real, ir de A a B no cuesta lo mismo que de B a A.
 *
 * - Hasta `EXACT_TOUR_MAX_STOPS` paradas: programación dinámica de Held-Karp,
 *   que devuelve el orden óptimo exacto.
 * - Por encima: vecino más cercano como punto de partida y mejora local
 *   (reubicar una parada e invertir tramos) hasta que no se pueda acortar más.
 *
 * Módulo puro: sin red, sin base de datos, determinista.
 */

/** Con 12 paradas Held-Karp evalúa ~600.000 estados: instantáneo. */
export const EXACT_TOUR_MAX_STOPS = 12;
/** Tope de pasadas de mejora local; cada pasada solo acepta mejoras reales. */
const MAX_IMPROVEMENT_PASSES = 50;
/** Mejora mínima (minutos) para aceptar un cambio y no oscilar por redondeos. */
const MIN_IMPROVEMENT = 1e-9;
const BASE_INDEX = 0;

export type CostMatrix = readonly (readonly number[])[];

function legCost(costs: CostMatrix, from: number, to: number): number {
  const value = costs[from]?.[to];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Coste del circuito base → `order` → base. */
export function tourCost(costs: CostMatrix, order: readonly number[]): number {
  if (order.length === 0) {
    return 0;
  }
  const path = [BASE_INDEX, ...order, BASE_INDEX];
  return path
    .slice(1)
    .reduce((total, node, index) => total + legCost(costs, path[index], node), 0);
}

function nearestNeighborOrder(costs: CostMatrix, stopCount: number): number[] {
  const order: number[] = [];
  const pending = new Set(Array.from({ length: stopCount }, (_, index) => index + 1));
  let current = BASE_INDEX;
  while (pending.size > 0) {
    let best = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const candidate of pending) {
      const cost = legCost(costs, current, candidate);
      // Empate: gana el índice menor, para que el resultado sea determinista.
      if (cost < bestCost || (cost === bestCost && candidate < best)) {
        best = candidate;
        bestCost = cost;
      }
    }
    order.push(best);
    pending.delete(best);
    current = best;
  }
  return order;
}

function relocate(order: readonly number[], from: number, to: number): number[] {
  const without = order.filter((_, index) => index !== from);
  return [...without.slice(0, to), order[from], ...without.slice(to)];
}

function reverseSegment(order: readonly number[], start: number, end: number): number[] {
  return [
    ...order.slice(0, start),
    ...order.slice(start, end + 1).reverse(),
    ...order.slice(end + 1),
  ];
}

/** Todos los vecinos de `order`: reubicar una parada o invertir un tramo. */
function* neighbours(order: readonly number[]): Generator<number[]> {
  const size = order.length;
  for (let from = 0; from < size; from += 1) {
    for (let to = 0; to < size; to += 1) {
      if (to !== from) {
        yield relocate(order, from, to);
      }
    }
  }
  for (let start = 0; start < size - 1; start += 1) {
    for (let end = start + 1; end < size; end += 1) {
      yield reverseSegment(order, start, end);
    }
  }
}

function improveLocally(costs: CostMatrix, initial: readonly number[]): number[] {
  let best = [...initial];
  let bestCost = tourCost(costs, best);
  for (let pass = 0; pass < MAX_IMPROVEMENT_PASSES; pass += 1) {
    let improved = false;
    for (const candidate of neighbours(best)) {
      const cost = tourCost(costs, candidate);
      if (cost < bestCost - MIN_IMPROVEMENT) {
        best = candidate;
        bestCost = cost;
        improved = true;
      }
    }
    if (!improved) {
      break;
    }
  }
  return best;
}

/** Held-Karp: orden óptimo exacto del circuito cerrado. */
function exactOrder(costs: CostMatrix, stopCount: number): number[] {
  const fullMask = (1 << stopCount) - 1;
  const stateCount = (fullMask + 1) * stopCount;
  const best = new Float64Array(stateCount).fill(Number.POSITIVE_INFINITY);
  const parent = new Int16Array(stateCount).fill(-1);
  const at = (mask: number, last: number) => mask * stopCount + last;

  for (let stop = 0; stop < stopCount; stop += 1) {
    best[at(1 << stop, stop)] = legCost(costs, BASE_INDEX, stop + 1);
  }
  for (let mask = 1; mask <= fullMask; mask += 1) {
    for (let last = 0; last < stopCount; last += 1) {
      const current = best[at(mask, last)];
      if (!(mask & (1 << last)) || current === Number.POSITIVE_INFINITY) {
        continue;
      }
      for (let next = 0; next < stopCount; next += 1) {
        if (mask & (1 << next)) {
          continue;
        }
        const nextMask = mask | (1 << next);
        const cost = current + legCost(costs, last + 1, next + 1);
        if (cost < best[at(nextMask, next)]) {
          best[at(nextMask, next)] = cost;
          parent[at(nextMask, next)] = last;
        }
      }
    }
  }

  let endStop = 0;
  let endCost = Number.POSITIVE_INFINITY;
  for (let last = 0; last < stopCount; last += 1) {
    const cost = best[at(fullMask, last)] + legCost(costs, last + 1, BASE_INDEX);
    if (cost < endCost) {
      endCost = cost;
      endStop = last;
    }
  }

  const reversed: number[] = [];
  let mask = fullMask;
  let last = endStop;
  while (last >= 0) {
    reversed.push(last + 1);
    const previous = parent[at(mask, last)];
    mask &= ~(1 << last);
    last = previous;
  }
  return reversed.reverse();
}

/**
 * Con costes simétricos (estimación sin tráfico) un circuito y su inverso
 * cuestan lo mismo. A igualdad de coste se empieza por la parada más cercana a
 * la base, para que el resultado sea estable y fácil de leer.
 */
function preferNearestFirst(costs: CostMatrix, order: readonly number[]): number[] {
  const reversed = [...order].reverse();
  const sameCost =
    Math.abs(tourCost(costs, reversed) - tourCost(costs, order)) <= MIN_IMPROVEMENT;
  const reversedStartsNearer =
    legCost(costs, BASE_INDEX, reversed[0]) < legCost(costs, BASE_INDEX, order[0]);
  return sameCost && reversedStartsNearer ? reversed : [...order];
}

/**
 * Devuelve los índices de parada (1..n) en el orden que minimiza el circuito
 * base → paradas → base. `costs` debe ser de (n+1)×(n+1) con la base en 0.
 */
export function optimizeTourOrder(costs: CostMatrix, stopCount: number): number[] {
  if (stopCount <= 0) {
    return [];
  }
  if (stopCount === 1) {
    return [1];
  }
  const order =
    stopCount <= EXACT_TOUR_MAX_STOPS
      ? exactOrder(costs, stopCount)
      : improveLocally(costs, nearestNeighborOrder(costs, stopCount));
  return preferNearestFirst(costs, order);
}
