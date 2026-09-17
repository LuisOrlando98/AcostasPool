/**
 * Detección de nuevas versiones del service worker (`public/sw.js`).
 *
 * El SW llama a `skipWaiting()` al instalarse y a `clients.claim()` al
 * activarse, así que una versión nueva toma el control de la página sin
 * esperar. Aquí solo se observa ese ciclo para avisar (sin recargar por
 * cuenta propia): `updatefound` → worker `installed`/`activated`,
 * `controllerchange` y el mensaje `SW_UPDATED` que envía el propio SW.
 *
 * Todo se ignora cuando la página no tenía controlador al registrarse: en la
 * primera instalación también se dispara `controllerchange` (por `claim()`)
 * y no es una actualización.
 *
 * Las interfaces mínimas (`*Like`) permiten testear la lógica sin navegador.
 */

export const SW_UPDATED_MESSAGE_TYPE = "SW_UPDATED";
export const SW_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const NOTIFYING_WORKER_STATES: ReadonlySet<ServiceWorkerState> = new Set([
  "installed",
  "activated",
]);

export type ServiceWorkerLike = {
  readonly state: ServiceWorkerState;
  addEventListener(type: "statechange", listener: () => void): void;
  removeEventListener(type: "statechange", listener: () => void): void;
};

export type ServiceWorkerRegistrationLike = {
  readonly installing: ServiceWorkerLike | null;
  readonly waiting: ServiceWorkerLike | null;
  addEventListener(type: "updatefound", listener: () => void): void;
  removeEventListener(type: "updatefound", listener: () => void): void;
  update(): Promise<unknown>;
};

export type ServiceWorkerMessageEventLike = {
  readonly data: unknown;
};

export type ServiceWorkerContainerLike = {
  readonly controller: unknown;
  addEventListener(type: "controllerchange", listener: () => void): void;
  addEventListener(
    type: "message",
    listener: (event: ServiceWorkerMessageEventLike) => void
  ): void;
  removeEventListener(type: "controllerchange", listener: () => void): void;
  removeEventListener(
    type: "message",
    listener: (event: ServiceWorkerMessageEventLike) => void
  ): void;
};

export type UpdateWatcherOptions = {
  readonly registration: ServiceWorkerRegistrationLike;
  readonly container: ServiceWorkerContainerLike;
  /** Se invoca una sola vez por página, cuando hay una versión nueva lista. */
  readonly onUpdateAvailable: () => void;
};

export function isServiceWorkerUpdatedMessage(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === SW_UPDATED_MESSAGE_TYPE
  );
}

/**
 * Observa el registro y devuelve la función que retira todos los listeners.
 */
export function watchServiceWorkerUpdates({
  registration,
  container,
  onUpdateAvailable,
}: UpdateWatcherOptions): () => void {
  const hadController = container.controller !== null && container.controller !== undefined;
  const cleanups: Array<() => void> = [];
  let notified = false;

  const notify = () => {
    if (notified || !hadController) {
      return;
    }
    notified = true;
    onUpdateAvailable();
  };

  const trackWorker = (worker: ServiceWorkerLike | null) => {
    if (!worker) {
      return;
    }
    const onStateChange = () => {
      if (NOTIFYING_WORKER_STATES.has(worker.state)) {
        notify();
      }
    };
    worker.addEventListener("statechange", onStateChange);
    cleanups.push(() => worker.removeEventListener("statechange", onStateChange));
    onStateChange();
  };

  const onUpdateFound = () => trackWorker(registration.installing);
  const onControllerChange = () => notify();
  const onMessage = (event: ServiceWorkerMessageEventLike) => {
    if (isServiceWorkerUpdatedMessage(event.data)) {
      notify();
    }
  };

  registration.addEventListener("updatefound", onUpdateFound);
  container.addEventListener("controllerchange", onControllerChange);
  container.addEventListener("message", onMessage);
  cleanups.push(
    () => registration.removeEventListener("updatefound", onUpdateFound),
    () => container.removeEventListener("controllerchange", onControllerChange),
    () => container.removeEventListener("message", onMessage)
  );

  // Una versión ya esperando (instalada desde otra pestaña) también cuenta.
  trackWorker(registration.waiting);

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}

export type UpdateCheckSchedulerOptions = {
  readonly registration: Pick<ServiceWorkerRegistrationLike, "update">;
  readonly intervalMs?: number;
  readonly onCheckFailed?: (error: unknown) => void;
};

/**
 * Comprueba si hay una versión nueva al volver la app a primer plano y de
 * forma periódica: en una PWA instalada apenas hay navegaciones completas, que
 * es cuando el navegador revisa `sw.js` por su cuenta.
 */
export function scheduleServiceWorkerUpdateChecks({
  registration,
  intervalMs = SW_UPDATE_CHECK_INTERVAL_MS,
  onCheckFailed,
}: UpdateCheckSchedulerOptions): () => void {
  const check = () => {
    registration.update().catch((error: unknown) => {
      // Sin conexión la comprobación falla: no es un error de la app.
      onCheckFailed?.(error);
    });
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      check();
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  const timer = window.setInterval(check, intervalMs);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.clearInterval(timer);
  };
}
