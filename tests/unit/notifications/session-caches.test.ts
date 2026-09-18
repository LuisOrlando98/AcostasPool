import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SHELL_USER_CACHE_KEY,
  SHELL_USER_CACHE_TTL_MS,
  clearCachedShellUser,
  clearSessionCaches,
  getCachedSessionUserId,
  readCachedShellUser,
  setCachedSessionUserId,
  writeCachedShellUser,
  type ShellUser,
} from "@/components/layout/session-caches";
import {
  NOTIFICATIONS_CACHE_KEY,
  readRecentCache,
  writeRecentCache,
} from "@/lib/notifications/client-cache";

const NOW = 1_800_000_000_000;

const user: ShellUser = {
  name: "Ana Acosta",
  email: "ana@example.com",
  avatarUrl: null,
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

beforeEach(() => {
  storage = createSessionStorage();
  vi.stubGlobal("window", { sessionStorage: storage });
  setCachedSessionUserId(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readCachedShellUser / writeCachedShellUser", () => {
  it("devuelve lo escrito mientras la entrada está dentro del TTL", () => {
    writeCachedShellUser(user, NOW);

    expect(readCachedShellUser(NOW + SHELL_USER_CACHE_TTL_MS - 1)).toEqual(user);
  });

  it("ignora una entrada caducada", () => {
    writeCachedShellUser(user, NOW);

    expect(readCachedShellUser(NOW + SHELL_USER_CACHE_TTL_MS)).toBeNull();
  });

  it("devuelve null cuando no hay nada guardado", () => {
    expect(readCachedShellUser(NOW)).toBeNull();
  });

  it("descarta JSON corrupto y formas inesperadas sin lanzar", () => {
    storage.setItem(SHELL_USER_CACHE_KEY, "{not json");
    expect(readCachedShellUser(NOW)).toBeNull();

    storage.setItem(SHELL_USER_CACHE_KEY, JSON.stringify({ ts: NOW, user: "Ana" }));
    expect(readCachedShellUser(NOW)).toBeNull();

    storage.setItem(SHELL_USER_CACHE_KEY, JSON.stringify({ ts: NOW, user: { name: 42 } }));
    expect(readCachedShellUser(NOW)).toBeNull();

    storage.setItem(SHELL_USER_CACHE_KEY, JSON.stringify({ user }));
    expect(readCachedShellUser(NOW)).toBeNull();
  });

  it("no lanza cuando sessionStorage está bloqueado", () => {
    vi.stubGlobal("window", {
      get sessionStorage(): Storage {
        throw new Error("blocked");
      },
    });

    expect(() => writeCachedShellUser(user, NOW)).not.toThrow();
    expect(readCachedShellUser(NOW)).toBeNull();
    expect(() => clearCachedShellUser()).not.toThrow();
  });

  it("no lanza fuera del navegador", () => {
    vi.unstubAllGlobals();

    expect(() => writeCachedShellUser(user, NOW)).not.toThrow();
    expect(readCachedShellUser(NOW)).toBeNull();
  });
});

describe("cached session user id", () => {
  it("empieza vacío y conserva el último valor fijado", () => {
    expect(getCachedSessionUserId()).toBeNull();

    setCachedSessionUserId("user_1");

    expect(getCachedSessionUserId()).toBe("user_1");
  });
});

describe("clearSessionCaches", () => {
  it("olvida el usuario del drawer, el id de sesión y la caché de la campana", () => {
    writeCachedShellUser(user, NOW);
    setCachedSessionUserId("user_1");
    writeRecentCache({ unread: 2, notifications: [] }, NOW);

    clearSessionCaches();

    expect(readCachedShellUser(NOW)).toBeNull();
    expect(getCachedSessionUserId()).toBeNull();
    expect(readRecentCache(NOW)).toBeNull();
    expect(storage.snapshot[SHELL_USER_CACHE_KEY]).toBeUndefined();
    expect(storage.snapshot[NOTIFICATIONS_CACHE_KEY]).toBeUndefined();
  });
});
