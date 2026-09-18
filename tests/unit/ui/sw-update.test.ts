import { describe, expect, it, vi } from "vitest";
import {
  SW_UPDATED_MESSAGE_TYPE,
  isServiceWorkerUpdatedMessage,
  watchServiceWorkerUpdates,
  type ServiceWorkerContainerLike,
  type ServiceWorkerLike,
  type ServiceWorkerMessageEventLike,
  type ServiceWorkerRegistrationLike,
} from "@/lib/ui/sw-update";

type Listener = (...args: never[]) => void;

function createEmitter() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener: (type: string, listener: Listener) => {
      const set = listeners.get(type) ?? new Set<Listener>();
      listeners.set(type, set.add(listener));
    },
    removeEventListener: (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
    },
    emit: (type: string, ...args: unknown[]) => {
      listeners.get(type)?.forEach((listener) => listener(...(args as never[])));
    },
    count: (type: string) => listeners.get(type)?.size ?? 0,
  };
}

function createWorker(initialState: ServiceWorkerState) {
  const emitter = createEmitter();
  const worker = {
    state: initialState,
    addEventListener: emitter.addEventListener,
    removeEventListener: emitter.removeEventListener,
    setState: (state: ServiceWorkerState) => {
      worker.state = state;
      emitter.emit("statechange");
    },
    count: emitter.count,
  };
  return worker as ServiceWorkerLike & typeof worker;
}

function createRegistration(waiting: ServiceWorkerLike | null = null) {
  const emitter = createEmitter();
  const registration = {
    installing: null as ServiceWorkerLike | null,
    waiting,
    addEventListener: emitter.addEventListener,
    removeEventListener: emitter.removeEventListener,
    update: vi.fn(() => Promise.resolve()),
    emitUpdateFound: (worker: ServiceWorkerLike) => {
      registration.installing = worker;
      emitter.emit("updatefound");
    },
    count: emitter.count,
  };
  return registration as ServiceWorkerRegistrationLike & typeof registration;
}

function createContainer(controller: unknown) {
  const emitter = createEmitter();
  const container = {
    controller,
    addEventListener: emitter.addEventListener,
    removeEventListener: emitter.removeEventListener,
    emitControllerChange: () => emitter.emit("controllerchange"),
    emitMessage: (data: unknown) =>
      emitter.emit("message", { data } satisfies ServiceWorkerMessageEventLike),
    count: emitter.count,
  };
  return container as ServiceWorkerContainerLike & typeof container;
}

describe("isServiceWorkerUpdatedMessage", () => {
  it("recognises the message posted by public/sw.js", () => {
    expect(isServiceWorkerUpdatedMessage({ type: SW_UPDATED_MESSAGE_TYPE, version: "v2" })).toBe(
      true
    );
  });

  it("rejects other payloads", () => {
    expect(isServiceWorkerUpdatedMessage({ type: "OTHER" })).toBe(false);
    expect(isServiceWorkerUpdatedMessage(null)).toBe(false);
    expect(isServiceWorkerUpdatedMessage("SW_UPDATED")).toBe(false);
  });
});

describe("watchServiceWorkerUpdates", () => {
  it("notifies once when a new worker finishes installing on a controlled page", () => {
    // Arrange
    const registration = createRegistration();
    const container = createContainer({});
    const onUpdateAvailable = vi.fn();
    watchServiceWorkerUpdates({ registration, container, onUpdateAvailable });
    const worker = createWorker("installing");

    // Act
    registration.emitUpdateFound(worker);
    worker.setState("installed");
    worker.setState("activated");
    container.emitControllerChange();

    // Assert
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  it("stays silent on the very first install (no previous controller)", () => {
    const registration = createRegistration();
    const container = createContainer(null);
    const onUpdateAvailable = vi.fn();
    watchServiceWorkerUpdates({ registration, container, onUpdateAvailable });
    const worker = createWorker("installing");

    registration.emitUpdateFound(worker);
    worker.setState("installed");
    container.emitControllerChange();
    container.emitMessage({ type: SW_UPDATED_MESSAGE_TYPE });

    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });

  it("notifies on controllerchange even without observing updatefound", () => {
    const registration = createRegistration();
    const container = createContainer({});
    const onUpdateAvailable = vi.fn();
    watchServiceWorkerUpdates({ registration, container, onUpdateAvailable });

    container.emitControllerChange();

    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  it("notifies when the service worker posts SW_UPDATED", () => {
    const registration = createRegistration();
    const container = createContainer({});
    const onUpdateAvailable = vi.fn();
    watchServiceWorkerUpdates({ registration, container, onUpdateAvailable });

    container.emitMessage({ type: "unrelated" });
    expect(onUpdateAvailable).not.toHaveBeenCalled();

    container.emitMessage({ type: SW_UPDATED_MESSAGE_TYPE, version: "v2" });
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  it("treats an already waiting worker as an available update", () => {
    const registration = createRegistration(createWorker("installed"));
    const container = createContainer({});
    const onUpdateAvailable = vi.fn();

    watchServiceWorkerUpdates({ registration, container, onUpdateAvailable });

    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  it("removes every listener when stopped", () => {
    const registration = createRegistration();
    const container = createContainer({});
    const worker = createWorker("installing");
    const onUpdateAvailable = vi.fn();
    const stop = watchServiceWorkerUpdates({ registration, container, onUpdateAvailable });
    registration.emitUpdateFound(worker);

    stop();
    worker.setState("installed");
    container.emitControllerChange();

    expect(onUpdateAvailable).not.toHaveBeenCalled();
    expect(registration.count("updatefound")).toBe(0);
    expect(container.count("controllerchange")).toBe(0);
    expect(container.count("message")).toBe(0);
    expect(worker.count("statechange")).toBe(0);
  });
});
