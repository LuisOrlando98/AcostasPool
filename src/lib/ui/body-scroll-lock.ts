"use client";

/**
 * Bloqueo del scroll del documento con contador de referencias.
 *
 * - `overflow: hidden` en `body` y compensación del ancho de la barra de scroll
 *   con `padding-right` para que el contenido no salte al desaparecer.
 * - En iOS (donde `overflow: hidden` se ignora) se fija el `body`
 *   (`position: fixed; top: -scrollY`) y se restaura el scroll al desbloquear.
 * - El contador vive en `data-ap-scroll-lock-count` (API previa); varios
 *   modales pueden bloquear a la vez y el documento se libera con el último.
 */

const LOCK_COUNT_ATTR = "data-ap-scroll-lock-count";
const FULL_WIDTH = "100%";
const ZERO_OFFSET = "0";

export type ScrollLockStyleSnapshot = {
  readonly overflow: string;
  readonly paddingRight: string;
  readonly position: string;
  readonly top: string;
  readonly left: string;
  readonly right: string;
  readonly width: string;
};

export type ScrollLockMetrics = {
  readonly scrollbarWidth: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly bodyPaddingRight: number;
  readonly useFixedPosition: boolean;
};

export type ScrollLockTarget = {
  readonly style: {
    overflow: string;
    paddingRight: string;
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
  };
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

export type ScrollLockEnvironment = {
  readonly body: ScrollLockTarget;
  readonly readMetrics: () => ScrollLockMetrics;
  readonly scrollTo: (x: number, y: number) => void;
};

export type ScrollLockController = {
  readonly lock: () => () => void;
};

type RestoreState = {
  readonly styles: ScrollLockStyleSnapshot;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly useFixedPosition: boolean;
};

const CLEARED_STYLES: ScrollLockStyleSnapshot = {
  overflow: "",
  paddingRight: "",
  position: "",
  top: "",
  left: "",
  right: "",
  width: "",
};

export function parsePixels(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export type PlatformLike = {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
};

/** iPhone/iPad/iPod, incluido iPadOS con user agent de escritorio. */
export function isIosPlatform({ userAgent, maxTouchPoints }: PlatformLike): boolean {
  const iosRegex = /iPad|iPhone|iPod/i;
  const iPadOs = /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
  return iosRegex.test(userAgent) || iPadOs;
}

export function computeLockStyles(
  metrics: ScrollLockMetrics,
  current: ScrollLockStyleSnapshot
): ScrollLockStyleSnapshot {
  const paddingRight =
    metrics.scrollbarWidth > 0
      ? `${metrics.bodyPaddingRight + metrics.scrollbarWidth}px`
      : current.paddingRight;

  if (!metrics.useFixedPosition) {
    return { ...current, overflow: "hidden", paddingRight };
  }

  return {
    overflow: "hidden",
    paddingRight,
    position: "fixed",
    top: `${-metrics.scrollY}px`,
    left: `${-metrics.scrollX}px`,
    right: ZERO_OFFSET,
    width: FULL_WIDTH,
  };
}

function captureStyles(target: ScrollLockTarget): ScrollLockStyleSnapshot {
  const { overflow, paddingRight, position, top, left, right, width } = target.style;
  return { overflow, paddingRight, position, top, left, right, width };
}

function applyStyles(target: ScrollLockTarget, styles: ScrollLockStyleSnapshot) {
  target.style.overflow = styles.overflow;
  target.style.paddingRight = styles.paddingRight;
  target.style.position = styles.position;
  target.style.top = styles.top;
  target.style.left = styles.left;
  target.style.right = styles.right;
  target.style.width = styles.width;
}

function getLockCount(target: ScrollLockTarget): number {
  const raw = target.getAttribute(LOCK_COUNT_ATTR);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function createScrollLockController(
  env: ScrollLockEnvironment
): ScrollLockController {
  let restoreState: RestoreState | null = null;

  const acquire = () => {
    const { body } = env;
    const currentCount = getLockCount(body);
    if (currentCount === 0) {
      const metrics = env.readMetrics();
      const styles = captureStyles(body);
      restoreState = {
        styles,
        scrollX: metrics.scrollX,
        scrollY: metrics.scrollY,
        useFixedPosition: metrics.useFixedPosition,
      };
      applyStyles(body, computeLockStyles(metrics, styles));
    }
    body.setAttribute(LOCK_COUNT_ATTR, String(currentCount + 1));
  };

  const release = () => {
    const { body } = env;
    const nextCount = Math.max(0, getLockCount(body) - 1);
    if (nextCount > 0) {
      body.setAttribute(LOCK_COUNT_ATTR, String(nextCount));
      return;
    }
    body.removeAttribute(LOCK_COUNT_ATTR);
    const state = restoreState;
    restoreState = null;
    applyStyles(body, state?.styles ?? CLEARED_STYLES);
    if (state?.useFixedPosition) {
      env.scrollTo(state.scrollX, state.scrollY);
    }
  };

  return {
    lock: () => {
      acquire();
      let released = false;
      return () => {
        if (released) {
          return;
        }
        released = true;
        release();
      };
    },
  };
}

function createBrowserEnvironment(): ScrollLockEnvironment {
  return {
    body: document.body,
    readMetrics: () => ({
      scrollbarWidth: Math.max(
        0,
        window.innerWidth - document.documentElement.clientWidth
      ),
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      bodyPaddingRight: parsePixels(
        window.getComputedStyle(document.body).paddingRight
      ),
      useFixedPosition: isIosPlatform(window.navigator),
    }),
    scrollTo: (x, y) => {
      // Evita que `scroll-behavior: smooth` anime la restauración.
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(x, y);
      root.style.scrollBehavior = previousBehavior;
    },
  };
}

let browserController: ScrollLockController | null = null;

/**
 * Bloquea el scroll del documento y devuelve la función que lo libera. Llamar
 * a la función devuelta más de una vez no tiene efecto.
 */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") {
    return () => undefined;
  }
  browserController ??= createScrollLockController(createBrowserEnvironment());
  return browserController.lock();
}
