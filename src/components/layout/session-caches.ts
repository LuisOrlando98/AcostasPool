/**
 * Cachés de sesión por pestaña del shell.
 *
 * `AppShell` y `NotificationsBell` se instancian por página, así que sin caché
 * cada navegación repetiría `/api/auth/me` (y su viaje a base de datos). Aquí
 * viven las dos entradas que sobreviven a la navegación: el usuario del drawer
 * (sessionStorage, con TTL) y el id de la sesión que la campana usa para su
 * canal privado (memoria del módulo, viva mientras dure la pestaña).
 *
 * Son cachés por pestaña, no por cuenta: cualquier cambio de sesión sin
 * recargar la página (cerrar sesión, conmutador de vista de desarrollador)
 * debe llamar a `clearSessionCaches()` para no enseñar datos de la cuenta
 * anterior. La caché de la campana (`@/lib/notifications/client-cache`) se
 * invalida en el mismo paso.
 */
import { clearRecentCache } from "@/lib/notifications/client-cache";

/** Clave de sessionStorage del usuario del drawer. El sufijo permite invalidar formatos anteriores. */
export const SHELL_USER_CACHE_KEY = "ap:me-cache:v1";
/** Vida máxima de la entrada: pasada esta ventana se vuelve a pedir `/api/auth/me`. */
export const SHELL_USER_CACHE_TTL_MS = 5 * 60 * 1000;

export type ShellUser = {
  readonly name?: string;
  readonly email?: string;
  readonly avatarUrl?: string | null;
};

type StoredShellUser = {
  /** Marca de tiempo de escritura, en milisegundos. */
  readonly ts: number;
  readonly user: ShellUser;
};

/** Id del usuario de la sesión, resuelto una sola vez por pestaña (no por montaje). */
let cachedSessionUserId: string | null = null;

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    // sessionStorage bloqueado (modo privado, políticas del navegador).
    return null;
  }
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

/** Valida la forma mínima que el drawer necesita para pintar la cuenta. */
function isShellUser(value: unknown): value is ShellUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    isOptionalString(candidate.name) &&
    isOptionalString(candidate.email) &&
    (candidate.avatarUrl === null || isOptionalString(candidate.avatarUrl))
  );
}

function parseStoredShellUser(raw: string, now: number): ShellUser | null {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const candidate = parsed as Partial<StoredShellUser>;
  if (typeof candidate.ts !== "number" || now - candidate.ts >= SHELL_USER_CACHE_TTL_MS) {
    return null;
  }
  return isShellUser(candidate.user) ? candidate.user : null;
}

/** Usuario guardado en esta pestaña, o `null` si no existe, caducó o no es legible. */
export function readCachedShellUser(now: number = Date.now()): ShellUser | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(SHELL_USER_CACHE_KEY);
    return raw ? parseStoredShellUser(raw, now) : null;
  } catch {
    // JSON corrupto o lectura denegada: se trata como ausencia de caché.
    return null;
  }
}

export function writeCachedShellUser(user: ShellUser, now: number = Date.now()): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  try {
    const stored: StoredShellUser = { ts: now, user };
    storage.setItem(SHELL_USER_CACHE_KEY, JSON.stringify(stored));
  } catch {
    // Cuota agotada o almacenamiento denegado: el drawer vuelve a pedir el usuario.
  }
}

export function clearCachedShellUser(): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(SHELL_USER_CACHE_KEY);
  } catch {
    // Sin almacenamiento la caché no existe: nada que invalidar.
  }
}

export function getCachedSessionUserId(): string | null {
  return cachedSessionUserId;
}

export function setCachedSessionUserId(id: string | null): void {
  cachedSessionUserId = id;
}

/**
 * Olvida todo lo cacheado de la sesión actual (usuario del drawer, id de sesión
 * y notificaciones recientes). Obligatorio antes de cambiar de cuenta sin
 * recargar la página.
 */
export function clearSessionCaches(): void {
  clearCachedShellUser();
  cachedSessionUserId = null;
  clearRecentCache();
}
