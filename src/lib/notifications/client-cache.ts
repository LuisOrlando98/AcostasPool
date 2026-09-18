/**
 * Caché de sesión de la campana de notificaciones.
 *
 * Pinta el panel al instante mientras `/api/notifications/unread` y
 * `/api/notifications/recent` responden. Es una caché *optimista*: cualquier
 * acción que cambie el estado en el servidor (marcar leída, borrar, limpiar)
 * debe invalidarla con `clearRecentCache()` ANTES de recargar, o la recarga
 * volvería a pintar las filas ya eliminadas.
 */

/** Clave de sessionStorage. El sufijo de versión permite invalidar formatos anteriores. */
export const NOTIFICATIONS_CACHE_KEY = "ap:notifications:recent:v1";
/** Vida máxima de una entrada de caché. Pasada esta ventana se ignora. */
export const NOTIFICATIONS_CACHE_TTL_MS = 30 * 1000;

export type RecentNotification = {
  id: string;
  eventType: string;
  status: string;
  createdAt: string;
  readAt?: string | null;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  payload?: Record<string, unknown> | null;
  customerName?: string | null;
  link?: string | null;
};

export type RecentNotificationsCache = {
  readonly unread: number;
  readonly notifications: readonly RecentNotification[];
};

type StoredCache = RecentNotificationsCache & {
  /** Marca de tiempo de escritura, en milisegundos. */
  readonly ts: number;
};

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

/** Valida la forma mínima que la campana necesita para pintar una fila. */
function isRecentNotification(value: unknown): value is RecentNotification {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.eventType === "string" &&
    typeof item.createdAt === "string"
  );
}

function parseStoredCache(raw: string, now: number): RecentNotificationsCache | null {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const candidate = parsed as Partial<StoredCache>;
  if (
    typeof candidate.ts !== "number" ||
    now - candidate.ts >= NOTIFICATIONS_CACHE_TTL_MS ||
    !Array.isArray(candidate.notifications)
  ) {
    return null;
  }
  return {
    unread: typeof candidate.unread === "number" ? candidate.unread : 0,
    notifications: candidate.notifications.filter(isRecentNotification),
  };
}

/** Devuelve la caché vigente, o `null` si no existe, caducó o no es legible. */
export function readRecentCache(now: number = Date.now()): RecentNotificationsCache | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(NOTIFICATIONS_CACHE_KEY);
    return raw ? parseStoredCache(raw, now) : null;
  } catch {
    // JSON corrupto o lectura denegada: se trata como ausencia de caché.
    return null;
  }
}

export function writeRecentCache(
  value: RecentNotificationsCache,
  now: number = Date.now()
): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  try {
    const stored: StoredCache = { ts: now, ...value };
    storage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(stored));
  } catch {
    // Cuota agotada o almacenamiento denegado: la campana sigue funcionando sin caché.
  }
}

/** Invalida la caché. Obligatorio tras marcar leída, borrar o limpiar. */
export function clearRecentCache(): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(NOTIFICATIONS_CACHE_KEY);
  } catch {
    // Sin almacenamiento la caché no existe: nada que invalidar.
  }
}
