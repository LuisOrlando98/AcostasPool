"use client";

import { useEffect, type RefObject } from "react";
import { createLayerStack } from "@/lib/ui/use-escape-key";

export type FocusTrapOptions = {
  /** Mientras sea true el foco queda confinado dentro de `ref`. */
  readonly active: boolean;
  /** Elemento que recibe el foco al activarse (por defecto, el primero tabulable). */
  readonly initialFocus?: RefObject<HTMLElement | null>;
  /** Elemento al que vuelve el foco al desactivarse (por defecto, el que lo tenía). */
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]",
].join(",");

/**
 * Superficie mínima de un elemento para decidir si es tabulable. `HTMLElement`
 * la cumple; los tests usan objetos planos.
 */
export type FocusableLike = {
  readonly tabIndex: number;
  hasAttribute(name: string): boolean;
  closest(selector: string): unknown;
  getClientRects(): { readonly length: number };
};

export function isTabbable(element: FocusableLike): boolean {
  if (element.tabIndex < 0 || element.hasAttribute("disabled")) {
    return false;
  }
  if (element.closest("[inert]")) {
    return false;
  }
  return element.getClientRects().length > 0;
}

/**
 * Orden de tabulación del navegador: `tabindex` positivos ascendentes primero,
 * después los de valor 0 en orden de documento (orden estable de entrada).
 */
export function sortByTabIndex<T extends { readonly tabIndex: number }>(
  elements: readonly T[]
): T[] {
  const positives = elements
    .filter((element) => element.tabIndex > 0)
    .sort((left, right) => left.tabIndex - right.tabIndex);
  const naturals = elements.filter((element) => element.tabIndex === 0);
  return [...positives, ...naturals];
}

export function getTabbableElements(container: ParentNode): HTMLElement[] {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  return sortByTabIndex(candidates.filter(isTabbable));
}

/**
 * Decide a qué elemento saltar al pulsar Tab/Shift+Tab. Devuelve `null` cuando
 * el navegador puede seguir su orden natural (el foco está en medio de la lista).
 */
export function resolveTabTarget<T>(
  elements: readonly T[],
  activeElement: T | null,
  shiftKey: boolean
): T | null {
  if (elements.length === 0) {
    return null;
  }
  const first = elements[0];
  const last = elements[elements.length - 1];
  const index = activeElement === null ? -1 : elements.indexOf(activeElement);
  if (index === -1) {
    return shiftKey ? last : first;
  }
  if (shiftKey) {
    return index === 0 ? last : null;
  }
  return index === elements.length - 1 ? first : null;
}

function getActiveElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement ? active : null;
}

function focusWithin(container: HTMLElement, preferred: HTMLElement | null) {
  const current = getActiveElement();
  if (current && container.contains(current) && current !== container) {
    // Algo dentro ya tiene el foco (por ejemplo un `autoFocus`): se respeta.
    return;
  }
  const fallback = getTabbableElements(container)[0] ?? container;
  const target = preferred && container.contains(preferred) ? preferred : fallback;
  target.focus();
}

function restoreFocus(target: HTMLElement | null) {
  if (target && target.isConnected) {
    target.focus();
  }
}

const focusLayers = createLayerStack<symbol>();

/**
 * Trampa de foco sin dependencias: enfoca al activarse, mantiene Tab/Shift+Tab
 * dentro del contenedor (solo la capa superior actúa, para modales anidados) y
 * devuelve el foco al desactivarse. El contenedor debe tener `tabIndex={-1}`
 * para servir de último recurso cuando no hay elementos tabulables.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  { active, initialFocus, returnFocusTo }: FocusTrapOptions
): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }
    const container = ref.current;
    if (!container) {
      return;
    }

    const token = Symbol("focus-trap");
    focusLayers.push(token);
    // Se capturan al activarse: en el cleanup el ref del disparador puede ya
    // apuntar a otro nodo (o a null) si el llamante se volvió a renderizar.
    const returnTarget = returnFocusTo?.current ?? getActiveElement();
    focusWithin(container, initialFocus?.current ?? null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented || !focusLayers.isTop(token)) {
        return;
      }
      const elements = getTabbableElements(container);
      if (elements.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const target = resolveTabTarget(elements, getActiveElement(), event.shiftKey);
      if (target) {
        event.preventDefault();
        target.focus();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!focusLayers.isTop(token)) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && container.contains(target)) {
        return;
      }
      focusWithin(container, null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      focusLayers.remove(token);
      restoreFocus(returnTarget);
    };
  }, [active, ref, initialFocus, returnFocusTo]);
}
