"use client";

import { useEffect, useRef } from "react";

/**
 * Pila de capas compartida por los modales abiertos. Cada activación de
 * `useEscapeKey` registra un token; solo la capa superior (la última que se
 * abrió) reacciona a Escape, de modo que con modales anidados se cierra
 * únicamente el más reciente. La pila se reasigna con arrays nuevos (sin
 * mutación in-place) para que sea fácil de razonar y testear.
 */
export type LayerStack<T> = {
  readonly push: (entry: T) => void;
  readonly remove: (entry: T) => void;
  readonly isTop: (entry: T) => boolean;
  readonly size: () => number;
};

export function createLayerStack<T>(): LayerStack<T> {
  let entries: readonly T[] = [];

  return {
    push: (entry) => {
      entries = [...entries.filter((candidate) => candidate !== entry), entry];
    },
    remove: (entry) => {
      entries = entries.filter((candidate) => candidate !== entry);
    },
    isTop: (entry) => entries.length > 0 && entries[entries.length - 1] === entry,
    size: () => entries.length,
  };
}

export type EscapeKeyEventLike = Pick<
  KeyboardEvent,
  "key" | "defaultPrevented" | "isComposing"
>;

const ESCAPE_KEYS: readonly string[] = ["Escape", "Esc"];

/**
 * Escape "limpio": no consumido por un componente interior (por ejemplo un
 * desplegable que ya llamó a `preventDefault`) ni parte de una composición IME.
 */
export function isEscapeKeyEvent(event: EscapeKeyEventLike): boolean {
  return (
    ESCAPE_KEYS.includes(event.key) && !event.defaultPrevented && !event.isComposing
  );
}

export type EscapeKeyHandler = (event: KeyboardEvent) => void;

const escapeLayers = createLayerStack<symbol>();

/**
 * Ejecuta `handler` al pulsar Escape mientras `active` sea true, solo si esta
 * capa es la superior de la pila. Los componentes interiores pueden vetar el
 * cierre llamando a `event.preventDefault()` en su propio `onKeyDown`.
 */
export function useEscapeKey(handler: EscapeKeyHandler, active: boolean): void {
  const handlerRef = useRef<EscapeKeyHandler>(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }

    const token = Symbol("escape-layer");
    escapeLayers.push(token);

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isEscapeKeyEvent(event) || !escapeLayers.isTop(token)) {
        return;
      }
      event.preventDefault();
      handlerRef.current(event);
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      escapeLayers.remove(token);
    };
  }, [active]);
}
