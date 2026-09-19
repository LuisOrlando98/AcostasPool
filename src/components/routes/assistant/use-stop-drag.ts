"use client";

/**
 * Arrastrar y soltar paradas con *pointer events* (ratón, lápiz y dedo) sin
 * dependencias: el asa captura el puntero, así que todos los movimientos
 * llegan a ella aunque el dedo se salga de la fila. La geometría es pura
 * (`drag-index.ts`); aquí solo se miden los rectángulos y se decide qué
 * operación del borrador corresponde al soltar.
 *
 * Las zonas donde se puede soltar se marcan en el DOM con `data-drop-zone`
 * (id del técnico o `EXCLUDED_ZONE_ID`) y las filas reordenables con
 * `data-drag-row` + `data-job-id`, de modo que añadir una zona no obliga a
 * registrar nada en este hook.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  insertionIndex,
  resolveDropIndex,
  zoneAt,
  type RowBounds,
  type ZoneBounds,
} from "./drag-index";

/** Zona "Sin asignar / excluidos"; el resto de zonas son ids de técnico. */
export const EXCLUDED_ZONE_ID = "__excluded__";

const ZONE_ATTRIBUTE = "data-drop-zone";
const JOB_ATTRIBUTE = "data-job-id";
const ROW_SELECTOR = "[data-drag-row]";
const PRIMARY_BUTTON = 0;
const ESCAPE_KEY = "Escape";

export type StopDragState = {
  readonly jobId: string;
  /** Zona bajo el puntero; `null` fuera de todas (soltar ahí no hace nada). */
  readonly zoneId: string | null;
  /** Posición de inserción dentro de la lista visible de la zona. */
  readonly index: number | null;
};

export type StopDragHandleProps = {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
};

export type StopDragController = {
  readonly state: StopDragState | null;
  readonly handleProps: (jobId: string) => StopDragHandleProps;
};

type StopDragOptions = {
  /** Contenedor que envuelve todas las zonas donde se puede soltar. */
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly disabled: boolean;
  /** Soltar sobre una ruta: índice ya listo para `moveStopToRoute`. */
  readonly onDrop: (jobId: string, technicianId: string, index: number) => void;
  readonly onExclude: (jobId: string) => void;
  readonly onCancel: () => void;
};

type RowWithJob = RowBounds & { readonly jobId: string };

const toBounds = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
};

/**
 * Safari lanza si el puntero ya se soltó entre el evento y esta llamada. Sin
 * captura el arrastre sigue funcionando mientras el puntero esté sobre el asa,
 * así que no hay nada que contarle al usuario.
 */
function capturePointer(element: HTMLElement, pointerId: number): boolean {
  try {
    element.setPointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}

export function useStopDrag({
  containerRef,
  disabled,
  onDrop,
  onExclude,
  onCancel,
}: StopDragOptions): StopDragController {
  const [state, setState] = useState<StopDragState | null>(null);
  const stateRef = useRef<StopDragState | null>(null);
  const captureRef = useRef<{ element: HTMLElement; pointerId: number } | null>(null);

  const update = useCallback((next: StopDragState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const readZones = useCallback((): ZoneBounds[] => {
    const container = containerRef.current;
    if (!container) {
      return [];
    }
    return Array.from(
      container.querySelectorAll<HTMLElement>(`[${ZONE_ATTRIBUTE}]`)
    ).map((element) => ({
      id: element.getAttribute(ZONE_ATTRIBUTE) ?? "",
      ...toBounds(element),
    }));
  }, [containerRef]);

  const readRows = useCallback((zoneId: string): RowWithJob[] => {
    const zone = containerRef.current?.querySelector<HTMLElement>(
      `[${ZONE_ATTRIBUTE}="${CSS.escape(zoneId)}"]`
    );
    if (!zone) {
      return [];
    }
    return Array.from(zone.querySelectorAll<HTMLElement>(ROW_SELECTOR)).map(
      (element) => ({
        jobId: element.getAttribute(JOB_ATTRIBUTE) ?? "",
        ...toBounds(element),
      })
    );
  }, [containerRef]);

  const locate = useCallback(
    (clientX: number, clientY: number) => {
      const zoneId = zoneAt(readZones(), clientX, clientY);
      if (!zoneId || zoneId === EXCLUDED_ZONE_ID) {
        return { zoneId, index: null };
      }
      return { zoneId, index: insertionIndex(readRows(zoneId), clientY) };
    },
    [readRows, readZones]
  );

  const release = useCallback(() => {
    const capture = captureRef.current;
    captureRef.current = null;
    if (capture && capture.element.hasPointerCapture(capture.pointerId)) {
      capture.element.releasePointerCapture(capture.pointerId);
    }
  }, []);

  const cancel = useCallback(() => {
    if (!stateRef.current) {
      return;
    }
    release();
    update(null);
    onCancel();
  }, [onCancel, release, update]);

  const commit = useCallback(
    (current: StopDragState) => {
      // Si la propuesta se bloqueó a mitad del gesto (se está aplicando o
      // cambiaron los filtros), el arrastre se abandona en lugar de escribir
      // sobre un borrador congelado.
      if (disabled || !current.zoneId) {
        onCancel();
        return;
      }
      if (current.zoneId === EXCLUDED_ZONE_ID) {
        onExclude(current.jobId);
        return;
      }
      const rows = readRows(current.zoneId);
      const draggedIndex = rows.findIndex((row) => row.jobId === current.jobId);
      const rawIndex = current.index ?? rows.length;
      onDrop(
        current.jobId,
        current.zoneId,
        resolveDropIndex(rawIndex, draggedIndex < 0 ? null : draggedIndex)
      );
    },
    [disabled, onCancel, onDrop, onExclude, readRows]
  );

  const start = useCallback(
    (event: ReactPointerEvent<HTMLElement>, jobId: string) => {
      if (disabled || event.button > PRIMARY_BUTTON) {
        return;
      }
      // Evita que el gesto seleccione texto (ratón) o desplace la página (dedo).
      event.preventDefault();
      const element = event.currentTarget;
      if (capturePointer(element, event.pointerId)) {
        captureRef.current = { element, pointerId: event.pointerId };
      }
      update({ jobId, ...locate(event.clientX, event.clientY) });
    },
    [disabled, locate, update]
  );

  const move = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      event.preventDefault();
      const next = { jobId: current.jobId, ...locate(event.clientX, event.clientY) };
      if (next.zoneId === current.zoneId && next.index === current.index) {
        return;
      }
      update(next);
    },
    [locate, update]
  );

  const drop = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      event.preventDefault();
      release();
      update(null);
      commit(current);
    },
    [commit, release, update]
  );

  // Escape cancela sin tocar el borrador (WCAG 2.5.7: el arrastre se puede abortar).
  useEffect(() => {
    if (!state) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ESCAPE_KEY) {
        cancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancel, state]);

  const handleProps = useCallback(
    (jobId: string): StopDragHandleProps => ({
      onPointerDown: (event) => start(event, jobId),
      onPointerMove: move,
      onPointerUp: drop,
      onPointerCancel: cancel,
    }),
    [cancel, drop, move, start]
  );

  return { state, handleProps };
}
