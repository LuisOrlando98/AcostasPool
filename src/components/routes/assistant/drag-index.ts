/**
 * Geometría pura del arrastre de paradas: dónde caería la parada que se está
 * arrastrando según la posición del puntero. Sin React ni DOM (el hook
 * `use-stop-drag` mide los rectángulos y llama aquí), así que se prueba en
 * `tests/unit/components/routes-assistant/drag-index.test.ts`.
 */

/** Borde superior e inferior de una fila en coordenadas de ventana. */
export type RowBounds = {
  readonly top: number;
  readonly bottom: number;
};

/** Rectángulo de una zona donde se puede soltar (una ruta o los excluidos). */
export type ZoneBounds = RowBounds & {
  readonly id: string;
  readonly left: number;
  readonly right: number;
};

const midpoint = (row: RowBounds): number => (row.top + row.bottom) / 2;

/**
 * Índice (0..n) en el que se insertaría la parada dentro de la lista visible:
 * se inserta antes de la primera fila cuyo punto medio queda por debajo del
 * puntero y, si no hay ninguna, al final.
 */
export function insertionIndex(
  rows: readonly RowBounds[],
  clientY: number
): number {
  const before = rows.findIndex((row) => clientY < midpoint(row));
  return before < 0 ? rows.length : before;
}

/**
 * Índice que espera `moveStopToRoute`: cuando la parada se mueve dentro de su
 * propia ruta, el borrador la saca de la lista antes de insertarla, así que
 * cualquier posición por debajo de la suya se desplaza una fila.
 * `draggedIndex` es `null` si la parada viene de otra ruta o de los excluidos.
 */
export function resolveDropIndex(
  rawIndex: number,
  draggedIndex: number | null
): number {
  if (draggedIndex === null || rawIndex <= draggedIndex) {
    return rawIndex;
  }
  return rawIndex - 1;
}

/** Zona bajo el puntero, o `null` si está fuera de todas (soltar no hace nada). */
export function zoneAt(
  zones: readonly ZoneBounds[],
  clientX: number,
  clientY: number
): string | null {
  const match = zones.find(
    (zone) =>
      clientX >= zone.left &&
      clientX <= zone.right &&
      clientY >= zone.top &&
      clientY <= zone.bottom
  );
  return match?.id ?? null;
}
