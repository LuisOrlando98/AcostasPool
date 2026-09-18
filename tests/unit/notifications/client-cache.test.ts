import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldAnnounceNewUnread } from "@/lib/notifications/client-alert";
import {
  NOTIFICATIONS_CACHE_KEY,
  NOTIFICATIONS_CACHE_TTL_MS,
  clearRecentCache,
  readRecentCache,
  writeRecentCache,
  type RecentNotification,
} from "@/lib/notifications/client-cache";

const NOW = 1_800_000_000_000;

const notification: RecentNotification = {
  id: "notif_1",
  eventType: "CUSTOMER_REQUEST",
  status: "SENT",
  createdAt: "2026-09-17T10:00:00.000Z",
  readAt: null,
};

/** sessionStorage mínimo en memoria: el entorno de pruebas es `node`, sin DOM. */
function createSessionStorage(initial: Record<string, string> = {}) {
  let entries: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => entries[key] ?? null,
    setItem: (key: string, value: string) => {
      entries = { ...entries, [key]: value };
    },
    removeItem: (key: string) => {
      const { [key]: removed, ...rest } = entries;
      void removed;
      entries = rest;
    },
    get snapshot() {
      return entries;
    },
  };
}

type FakeStorage = ReturnType<typeof createSessionStorage>;

let storage: FakeStorage;

function stubWindow(sessionStorage: unknown) {
  vi.stubGlobal("window", { sessionStorage });
}

beforeEach(() => {
  storage = createSessionStorage();
  stubWindow(storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readRecentCache / writeRecentCache", () => {
  it("devuelve lo escrito mientras la entrada está dentro del TTL", () => {
    // Arrange
    writeRecentCache({ unread: 3, notifications: [notification] }, NOW);

    // Act
    const cached = readRecentCache(NOW + NOTIFICATIONS_CACHE_TTL_MS - 1);

    // Assert
    expect(cached).toEqual({ unread: 3, notifications: [notification] });
  });

  it("ignora una entrada caducada", () => {
    // Arrange
    writeRecentCache({ unread: 3, notifications: [notification] }, NOW);

    // Act
    const cached = readRecentCache(NOW + NOTIFICATIONS_CACHE_TTL_MS);

    // Assert
    expect(cached).toBeNull();
  });

  it("devuelve null cuando no hay nada guardado", () => {
    expect(readRecentCache(NOW)).toBeNull();
  });

  it("descarta JSON corrupto sin lanzar", () => {
    // Arrange
    storage.setItem(NOTIFICATIONS_CACHE_KEY, "{no-es-json");

    // Act & Assert
    expect(() => readRecentCache(NOW)).not.toThrow();
    expect(readRecentCache(NOW)).toBeNull();
  });

  it("descarta entradas sin marca de tiempo o sin lista de notificaciones", () => {
    // Arrange
    storage.setItem(
      NOTIFICATIONS_CACHE_KEY,
      JSON.stringify({ unread: 2, notifications: [notification] })
    );

    // Act & Assert
    expect(readRecentCache(NOW)).toBeNull();

    storage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify({ ts: NOW, unread: 2 }));
    expect(readRecentCache(NOW)).toBeNull();
  });

  it("filtra filas sin la forma mínima y normaliza un contador ausente", () => {
    // Arrange
    storage.setItem(
      NOTIFICATIONS_CACHE_KEY,
      JSON.stringify({ ts: NOW, notifications: [notification, { id: 7 }, null] })
    );

    // Act
    const cached = readRecentCache(NOW);

    // Assert
    expect(cached).toEqual({ unread: 0, notifications: [notification] });
  });

  it("no lanza cuando sessionStorage está bloqueado", () => {
    // Arrange
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    stubWindow(blocked);

    // Act & Assert
    expect(readRecentCache(NOW)).toBeNull();
    expect(() => writeRecentCache({ unread: 1, notifications: [] }, NOW)).not.toThrow();
    expect(() => clearRecentCache()).not.toThrow();
  });

  it("no lanza fuera del navegador", () => {
    // Arrange
    vi.stubGlobal("window", undefined);

    // Act & Assert
    expect(readRecentCache(NOW)).toBeNull();
    expect(() => writeRecentCache({ unread: 1, notifications: [] }, NOW)).not.toThrow();
    expect(() => clearRecentCache()).not.toThrow();
  });
});

describe("clearRecentCache", () => {
  it("deja la caché vacía para la siguiente lectura", () => {
    // Arrange
    writeRecentCache({ unread: 3, notifications: [notification] }, NOW);

    // Act
    clearRecentCache();

    // Assert
    expect(storage.snapshot[NOTIFICATIONS_CACHE_KEY]).toBeUndefined();
    expect(readRecentCache(NOW)).toBeNull();
  });
});

describe("shouldAnnounceNewUnread", () => {
  it("no anuncia un valor de caché aunque suba el contador", () => {
    expect(
      shouldAnnounceNewUnread({
        previous: 0,
        next: 3,
        source: "cache",
        hasServerValue: false,
      })
    ).toBe(false);
  });

  it("no anuncia un valor de caché posterior a la primera respuesta del servidor", () => {
    expect(
      shouldAnnounceNewUnread({
        previous: 1,
        next: 9,
        source: "cache",
        hasServerValue: true,
      })
    ).toBe(false);
  });

  it("no anuncia la primera respuesta del servidor tras montar", () => {
    expect(
      shouldAnnounceNewUnread({
        previous: 0,
        next: 3,
        source: "network",
        hasServerValue: false,
      })
    ).toBe(false);
  });

  it("anuncia cuando la red trae más sin leer que el último valor contabilizado", () => {
    expect(
      shouldAnnounceNewUnread({
        previous: 3,
        next: 4,
        source: "network",
        hasServerValue: true,
      })
    ).toBe(true);
  });

  it("no anuncia cuando el contador se mantiene o baja", () => {
    expect(
      shouldAnnounceNewUnread({
        previous: 3,
        next: 3,
        source: "network",
        hasServerValue: true,
      })
    ).toBe(false);
    expect(
      shouldAnnounceNewUnread({
        previous: 3,
        next: 0,
        source: "network",
        hasServerValue: true,
      })
    ).toBe(false);
  });

  it("vuelve a anunciar tras limpiar: 0 contabilizado y una nueva de red", () => {
    expect(
      shouldAnnounceNewUnread({
        previous: 0,
        next: 1,
        source: "network",
        hasServerValue: true,
      })
    ).toBe(true);
  });
});
