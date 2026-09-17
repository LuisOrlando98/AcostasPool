"use client";

/**
 * AppModal: capa modal accesible que reproduce la estructura DOM y las clases
 * de los modales existentes (`app-modal-layer` > backdrop + `app-modal-card`),
 * añadiendo role="dialog", foco inicial, trampa de foco, Escape (solo el modal
 * superior), retorno de foco, bloqueo de scroll e `inert` fuera del modal.
 *
 * GUÍA DE MIGRACIÓN (conservando el aspecto actual):
 * 1. `{open ? <div className="app-modal-layer fixed inset-0 z-[N] flex items-center justify-center <resto>">` pasa a
 *    `<AppModal open={open} onClose={cerrar} zIndexClass="z-[N]" layerClassName="<resto>">` (AppModal ya pone
 *    `app-modal-layer fixed inset-0 flex items-center justify-center` y renderiza null cuando `open` es false).
 * 2. Elimina el backdrop propio (`<button aria-label=close className="absolute inset-0"/>` o
 *    `<div className="app-modal-backdrop absolute inset-0 bg-slate-900/60"/>`): AppModal lo renderiza y cierra al pulsarlo;
 *    pasa `backdropClassName=""` si la capa ya lleva su propio `bg-slate-900/50`, u otras clases si difieren del default.
 * 3. Las clases del `<div className="app-modal-card relative z-10 w-full max-w-3xl ...">` van en `cardClassName`
 *    (sin repetir `app-modal-card relative z-10 w-full`); su contenido interior pasa tal cual como `children`.
 * 4. Pon `id={titleId}` (de `useId()`) en el `<h2>/<h3>` del título y pásalo como `titleId`; si no hay encabezado
 *    visible usa `title="..."` (se aplica como aria-label). Sustituye `h-[90vh]` por `max-h-[90dvh]`.
 * 5. Borra los `useEffect` manuales de `lockBodyScroll` y `keydown Escape` de ese modal y cualquier
 *    `role="dialog"`/`aria-modal` duplicado dentro de la card: AppModal ya los gestiona (props `closeOnEscape`/`closeOnBackdrop`).
 * 6. Quita el `createPortal(..., document.body)` propio (`portal` es true por defecto y SSR-safe); para un modal
 *    renderizado dentro de la card de otro usa `portal={false}`. Sustituye `window.confirm` por `<ConfirmDialog>`.
 */

import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";
import { useEscapeKey } from "@/lib/ui/use-escape-key";
import { useFocusTrap } from "@/lib/ui/use-focus-trap";

export type AppModalSize = "sm" | "md" | "lg" | "xl" | "full";

export type AppModalProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  /** id del encabezado visible (aria-labelledby). Tiene prioridad sobre `title`. */
  readonly titleId?: string;
  /** Nombre accesible cuando no hay encabezado visible (aria-label). */
  readonly title?: string;
  /** id del elemento descriptivo (aria-describedby). */
  readonly describedBy?: string;
  /** Ancho máximo de la card. Sin `size`, el ancho lo controlan tus clases. */
  readonly size?: AppModalSize;
  /** Sustituye el z-index por defecto (`z-[1300]`). */
  readonly zIndexClass?: string;
  /** Clases extra de la capa (`overflow-y-auto p-3 sm:p-6`, `bg-slate-900/50`...). */
  readonly layerClassName?: string;
  /** Sustituye las clases del backdrop por defecto (`app-modal-backdrop bg-slate-900/60`); "" lo deja transparente. */
  readonly backdropClassName?: string;
  /** Clases extra de la card (`max-w-3xl overflow-hidden rounded-3xl border ...`). */
  readonly cardClassName?: string;
  /** Alias de `cardClassName` (se concatena a la card). */
  readonly className?: string;
  readonly closeOnBackdrop?: boolean;
  readonly closeOnEscape?: boolean;
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  /** true: se renderiza en `document.body`. false: en el lugar del árbol donde se declara. */
  readonly portal?: boolean;
  readonly children: ReactNode;
};

export const APP_MODAL_SIZE_CLASS: Record<AppModalSize, string> = {
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-none",
};

export const APP_MODAL_DEFAULT_Z_INDEX_CLASS = "z-[1300]";
export const APP_MODAL_DEFAULT_BACKDROP_CLASS = "app-modal-backdrop bg-slate-900/60";

const LAYER_BASE_CLASS = "app-modal-layer fixed inset-0 flex items-center justify-center";
const BACKDROP_BASE_CLASS = "absolute inset-0";
const CARD_BASE_CLASS = "app-modal-card relative z-10 w-full outline-none";

/**
 * Etiquetas que nunca se marcan como `inert`: las que no se renderizan y el
 * overlay de desarrollo de Next.js (debe seguir siendo interactivo).
 */
const INERT_EXEMPT_TAGS: ReadonlySet<string> = new Set([
  "SCRIPT",
  "STYLE",
  "LINK",
  "META",
  "TEMPLATE",
  "NOSCRIPT",
  "NEXTJS-PORTAL",
]);

export function joinClassNames(...parts: ReadonlyArray<string | undefined>): string {
  return parts.filter((part) => part && part.trim().length > 0).join(" ");
}

export type InertTreeNode<T> = {
  readonly tagName: string;
  readonly parentElement: T | null;
  readonly children: Iterable<T>;
  hasAttribute(name: string): boolean;
};

export type InertTarget<T> = InertTreeNode<T> & {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

/**
 * Hermanos de `node` y de cada ancestro hasta `body` que aún no son `inert`.
 * Los que ya lo eran (p. ej. por otro modal anidado) se dejan intactos para
 * que cada modal solo revierta lo que él marcó.
 */
export function collectInertTargets<T extends InertTreeNode<T>>(node: T): T[] {
  const parent = node.parentElement;
  if (!parent) {
    return [];
  }
  const siblings = Array.from(parent.children).filter(
    (child) =>
      child !== node &&
      !INERT_EXEMPT_TAGS.has(child.tagName.toUpperCase()) &&
      !child.hasAttribute("inert")
  );
  if (parent.tagName.toUpperCase() === "BODY") {
    return siblings;
  }
  return [...siblings, ...collectInertTargets(parent)];
}

export function applyInertOutside<T extends InertTarget<T>>(layer: T): () => void {
  const targets = collectInertTargets(layer);
  targets.forEach((target) => target.setAttribute("inert", ""));
  return () => {
    targets.forEach((target) => target.removeAttribute("inert"));
  };
}

const subscribeToNothing = () => () => undefined;
const readClientSnapshot = () => true;
const readServerSnapshot = () => false;

function useIsClient(): boolean {
  return useSyncExternalStore(subscribeToNothing, readClientSnapshot, readServerSnapshot);
}

export default function AppModal({
  open,
  onClose,
  titleId,
  title,
  describedBy,
  size,
  zIndexClass = APP_MODAL_DEFAULT_Z_INDEX_CLASS,
  layerClassName,
  backdropClassName = APP_MODAL_DEFAULT_BACKDROP_CLASS,
  cardClassName,
  className,
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
  returnFocusRef,
  portal = true,
  children,
}: AppModalProps) {
  const isClient = useIsClient();
  const layerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isRendered = open && (!portal || isClient);

  // La capa sigue registrada en la pila mientras esté abierta aunque no cierre
  // con Escape (p. ej. `busy`): así un modal ocupado no deja pasar Escape al
  // modal que tenga debajo.
  useEscapeKey(() => {
    if (closeOnEscape) {
      onClose();
    }
  }, isRendered);

  // Declarado antes de la trampa de foco a propósito: los cleanups corren en
  // orden de declaración y el foco solo puede volver al disparador cuando sus
  // ancestros ya no son `inert`.
  useEffect(() => {
    if (!isRendered) {
      return;
    }
    const layer = layerRef.current;
    const unlock = lockBodyScroll();
    const releaseInert = layer ? applyInertOutside<Element>(layer) : () => undefined;
    return () => {
      releaseInert();
      unlock();
    };
  }, [isRendered]);

  useFocusTrap(cardRef, {
    active: isRendered,
    initialFocus: initialFocusRef,
    returnFocusTo: returnFocusRef,
  });

  if (!isRendered) {
    return null;
  }

  const layer = (
    <div
      ref={layerRef}
      className={joinClassNames(LAYER_BASE_CLASS, zIndexClass, layerClassName)}
    >
      <div
        aria-hidden="true"
        className={joinClassNames(BACKDROP_BASE_CLASS, backdropClassName)}
        onClick={closeOnBackdrop ? () => onClose() : undefined}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={titleId ? undefined : title}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={joinClassNames(
          CARD_BASE_CLASS,
          size ? APP_MODAL_SIZE_CLASS[size] : undefined,
          cardClassName,
          className
        )}
      >
        {children}
      </div>
    </div>
  );

  return portal ? createPortal(layer, document.body) : layer;
}
