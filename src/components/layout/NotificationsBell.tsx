"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  type PointerEvent,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Channel, default as PusherClient } from "pusher-js";
import NotificationSoundToggle from "@/components/notifications/NotificationSoundToggle";
import { useLiveAnnouncement } from "@/components/notifications/use-live-announcement";
import { useI18n } from "@/i18n/client";
import {
  getNotificationDetail,
  getNotificationSource,
  getNotificationTitle,
} from "@/lib/notifications/view";
import {
  emitNotificationSignal,
  shouldAnnounceNewUnread,
  type UnreadValueSource,
} from "@/lib/notifications/client-alert";
import {
  clearRecentCache,
  readRecentCache,
  writeRecentCache,
  type RecentNotification,
} from "@/lib/notifications/client-cache";
import { subscribeNotificationsChanged } from "@/lib/notifications/client-events";
import {
  addBusinessDays,
  formatInBusinessTimeZone,
  startOfBusinessDay,
} from "@/lib/timezone";
import { useEscapeKey } from "@/lib/ui/use-escape-key";
import { useFocusTrap } from "@/lib/ui/use-focus-trap";

type NotificationItem = RecentNotification;

/** Novedad pendiente de anunciar: la decide `load()`, la renderiza un efecto con el idioma actual. */
type NewUnreadAlert = {
  readonly id: string;
  /** Notificación sin leer más reciente, o `null` si la lista no trae ninguna. */
  readonly item: NotificationItem | null;
  /** Cuántas entraron desde el último valor contabilizado. */
  readonly count: number;
};

type LoadOptions = {
  /** `true` para recargas provocadas por el propio usuario: nunca suenan. */
  readonly silent?: boolean;
};

type LiveAlert = {
  id: string;
  title: string;
  body: string;
};

type PanelPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const ALERT_AUTO_CLOSE_MS = 4000;
const ALERT_HIDE_DURATION_MS = 220;
const ALERT_SWIPE_CLOSE_THRESHOLD = -60;
const ROW_SWIPE_OPEN_THRESHOLD = -36;
const ROW_SWIPE_DELETE_THRESHOLD = -56;
const ROW_SWIPE_MAX = -92;
const NOTIFICATIONS_POLL_INTERVAL_MS = 20 * 1000;
const INTERNAL_LINK_PREFIX = "/";
const PROTOCOL_RELATIVE_PREFIX = "//";

/** Enlace servido por la propia aplicación: "//host" apunta fuera del dominio. */
function isInternalLink(link: string): boolean {
  return (
    link.startsWith(INTERNAL_LINK_PREFIX) &&
    !link.startsWith(PROTOCOL_RELATIVE_PREFIX)
  );
}

function byCreatedDesc(a: NotificationItem, b: NotificationItem) {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  return bTime - aTime;
}

function formatRelativeDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatInBusinessTimeZone(date, locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.25 18.75a2.25 2.25 0 01-4.5 0m9-3.75V11.25a6.75 6.75 0 10-13.5 0V15L3 17.25h18l-2.25-2.25z"
      />
    </svg>
  );
}

export default function NotificationsBell() {
  const { t, locale } = useI18n();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [liveAlert, setLiveAlert] = useState<LiveAlert | null>(null);
  const [liveAlertVisible, setLiveAlertVisible] = useState(false);
  const [alertDragOffset, setAlertDragOffset] = useState(0);
  const [panelPlacement, setPanelPlacement] = useState<PanelPlacement | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const [newUnreadAlert, setNewUnreadAlert] = useState<NewUnreadAlert | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const portalPanelRef = useRef<HTMLDivElement | null>(null);
  const bellButtonRef = useRef<HTMLButtonElement | null>(null);
  /** Último valor de "sin leer" ya contabilizado (red, caché o baja optimista local). */
  const previousUnreadRef = useRef(0);
  /** `true` en cuanto llega la primera respuesta del servidor de este montaje. */
  const hasServerValueRef = useRef(false);
  const announcedAlertIdRef = useRef<string | null>(null);
  /** Descarta respuestas desordenadas: solo la última carga lanzada escribe estado. */
  const loadSequenceRef = useRef(0);
  /**
   * Cambia con cada acción local (marcar leída, borrar, limpiar). Una carga que
   * la cruce trae un contador anterior a la acción: se aplica, pero no suena.
   */
  const localMutationRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const userIdRef = useRef<string | null>(null);
  const userIdRequestRef = useRef<Promise<string | null> | null>(null);
  const alertAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertSwipeStartYRef = useRef<number | null>(null);
  const rowSwipeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    isHorizontal: boolean;
    pointerId: number;
  } | null>(null);
  const rowSwipeConsumedIdRef = useRef<string | null>(null);
  const panelId = useId();
  const panelTitleId = useId();
  const router = useRouter();
  const { message: liveAnnouncement, announce } = useLiveAnnouncement();

  const usePusher =
    Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_PUSHER_CLUSTER);
  const canUseDom =
    typeof window !== "undefined" && typeof document !== "undefined";
  const panelRendered = open && canUseDom && panelPlacement !== null;
  const closePanel = useCallback(() => setOpen(false), []);

  // Popover anclado a la campana (no una capa centrada): diálogo no modal con
  // Escape, foco inicial en el propio panel y retorno del foco a la campana.
  useEscapeKey(closePanel, panelRendered);
  useFocusTrap(portalPanelRef, {
    active: panelRendered,
    initialFocus: portalPanelRef,
    returnFocusTo: bellButtonRef,
  });

  const resetLiveAlertTimers = () => {
    if (alertAutoTimerRef.current) {
      clearTimeout(alertAutoTimerRef.current);
      alertAutoTimerRef.current = null;
    }
    if (alertHideTimerRef.current) {
      clearTimeout(alertHideTimerRef.current);
      alertHideTimerRef.current = null;
    }
  };

  const dismissLiveAlert = useCallback(() => {
    setLiveAlertVisible(false);
    setAlertDragOffset(0);
    resetLiveAlertTimers();
    alertHideTimerRef.current = setTimeout(() => {
      setLiveAlert(null);
    }, ALERT_HIDE_DURATION_MS);
  }, []);

  const showLiveAlert = useCallback(
    (title: string, body: string) => {
      resetLiveAlertTimers();
      setAlertDragOffset(0);
      setLiveAlert({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        body,
      });
      setLiveAlertVisible(true);
      alertAutoTimerRef.current = setTimeout(() => {
        dismissLiveAlert();
      }, ALERT_AUTO_CLOSE_MS);
    },
    [dismissLiveAlert]
  );

  useEffect(
    () => () => {
      resetLiveAlertTimers();
      loadAbortRef.current?.abort();
    },
    []
  );

  /**
   * Identidad de la sesión, resuelta una sola vez por montaje y guardada en un
   * ref: si viviera en estado, `load` y el efecto de tiempo real cambiarían de
   * identidad al resolverse y duplicarían peticiones y suscripciones.
   */
  const resolveUserId = useCallback(async (): Promise<string | null> => {
    if (userIdRef.current) {
      return userIdRef.current;
    }
    if (!userIdRequestRef.current) {
      userIdRequestRef.current = (async () => {
        try {
          const response = await fetch("/api/auth/me", { cache: "no-store" });
          const data = (await response.json()) as { user?: { id?: unknown } };
          const id = typeof data.user?.id === "string" ? data.user.id : null;
          userIdRef.current = id;
          return id;
        } catch {
          // Reintentable: una caída de red no debe dejar la sesión sin resolver.
          userIdRequestRef.current = null;
          return null;
        }
      })();
    }
    return userIdRequestRef.current;
  }, []);

  /**
   * Contabiliza un valor de "sin leer" y devuelve cuántas entraron desde el
   * último ya contabilizado, o 0 cuando el valor no es una novedad anunciable
   * (la regla vive entera en `shouldAnnounceNewUnread`).
   */
  const countNewUnread = useCallback(
    (value: number, source: UnreadValueSource): number => {
      const previous = previousUnreadRef.current;
      const isNews = shouldAnnounceNewUnread({
        previous,
        next: value,
        source,
        hasServerValue: hasServerValueRef.current,
      });
      previousUnreadRef.current = value;
      return isNews ? value - previous : 0;
    },
    []
  );

  /**
   * Marca que el usuario acaba de cambiar el estado en el servidor: invalida la
   * caché —que ya está obsoleta— antes de que salga la petición y deja constancia
   * para que una carga en vuelo no confunda el contador anterior con una novedad.
   */
  const markLocalMutation = useCallback(() => {
    localMutationRef.current += 1;
    clearRecentCache();
  }, []);

  /**
   * Carga el contador y las últimas notificaciones.
   *
   * - La caché de sesión solo se aplica mientras no haya llegado ninguna
   *   respuesta del servidor en este montaje: después es siempre más vieja que
   *   el estado en memoria y resucitaría filas ya borradas.
   * - Cada llamada aborta la anterior y lleva número de secuencia, de modo que
   *   una respuesta desordenada nunca escribe estado ni sube el contador. Lo
   *   mismo vale para una respuesta anterior a una acción del usuario.
   * - `silent` marca las recargas provocadas por el propio usuario, que nunca
   *   suenan aunque el contador suba.
   */
  const load = useCallback(async ({ silent = false }: LoadOptions = {}) => {
    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;
    const mutationAtStart = localMutationRef.current;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const isCurrent = () => loadSequenceRef.current === sequence;

    setLoading(true);
    try {
      if (!hasServerValueRef.current) {
        const cached = readRecentCache();
        if (cached) {
          // Siembra la referencia sin anunciar: la regla descarta la caché.
          countNewUnread(cached.unread, "cache");
          setUnreadCount(cached.unread);
          setNotifications([...cached.notifications].sort(byCreatedDesc));
        }
      }

      const cacheBust = Date.now().toString();
      const [unreadRes, notificationsRes] = await Promise.all([
        fetch(`/api/notifications/unread?cb=${cacheBust}`, {
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch(`/api/notifications/recent?cb=${cacheBust}`, {
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);
      if (!unreadRes.ok || !notificationsRes.ok) {
        throw new Error(
          `Notifications requests failed with status ${unreadRes.status}/${notificationsRes.status}`
        );
      }
      const unreadData = (await unreadRes.json()) as { unread?: unknown };
      const notificationsData = (await notificationsRes.json()) as {
        notifications?: unknown;
      };
      if (!isCurrent() || localMutationRef.current !== mutationAtStart) {
        // Respuesta anterior a una acción del usuario (marcar leída, borrar,
        // limpiar): su contador y su lista ya no describen el servidor, así que
        // no se aplican ni se guardan en caché. Manda el estado optimista.
        return;
      }

      const unread =
        typeof unreadData.unread === "number" ? unreadData.unread : 0;
      const resolved = Array.isArray(notificationsData.notifications)
        ? (notificationsData.notifications as NotificationItem[])
        : [];
      const sorted = [...resolved].sort(byCreatedDesc);
      const newUnread = countNewUnread(unread, "network");

      hasServerValueRef.current = true;
      setUnreadCount(unread);
      setNotifications(sorted);
      setLoadFailed(false);
      writeRecentCache({ unread, notifications: resolved });

      if (newUnread > 0 && !silent) {
        setNewUnreadAlert({
          id: `${Date.now()}-${sequence}`,
          item: sorted.find((item) => !item.readAt) ?? null,
          count: newUnread,
        });
      }
    } catch {
      if (controller.signal.aborted || !isCurrent()) {
        return;
      }
      // Keep whatever is already shown (cache or previous load) and surface the failure.
      setLoadFailed(true);
    } finally {
      if (isCurrent()) {
        setLoading(false);
      }
    }
  }, [countNewUnread]);

  const updatePanelPlacement = useCallback(() => {
    if (!canUseDom || !bellButtonRef.current) {
      return;
    }
    const rect = bellButtonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const top = Math.min(viewportHeight - 220, rect.bottom + 10);
    const maxHeight = Math.max(300, viewportHeight - top - margin);

    if (viewportWidth < 640) {
      setPanelPlacement({
        top,
        left: margin,
        width: viewportWidth - margin * 2,
        maxHeight,
      });
      return;
    }

    const width = 352;
    const preferredLeft = rect.right - width;
    const left = Math.max(margin, Math.min(preferredLeft, viewportWidth - width - margin));
    setPanelPlacement({
      top,
      left,
      width,
      maxHeight: Math.min(560, maxHeight),
    });
  }, [canUseDom]);

  useEffect(() => {
    void load();
  }, [load]);

  // Acciones del centro de notificaciones (misma página): recarga sin sonido.
  useEffect(
    () =>
      subscribeNotificationsChanged(() => {
        void load({ silent: true });
      }),
    [load]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideInline = panelRef.current?.contains(target) ?? false;
      const insidePortal = portalPanelRef.current?.contains(target) ?? false;
      if (!insideInline && !insidePortal) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      setSwipeOffsets({});
      return;
    }
    updatePanelPlacement();
    const onResize = () => updatePanelPlacement();
    const onScroll = () => updatePanelPlacement();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, updatePanelPlacement]);

  useEffect(() => {
    if (!open || !canUseDom) {
      return;
    }
    const resetDesktopRows = () => {
      if (window.innerWidth >= 768) {
        setSwipeOffsets({});
      }
    };
    resetDesktopRows();
    window.addEventListener("resize", resetDesktopRows);
    return () => window.removeEventListener("resize", resetDesktopRows);
  }, [canUseDom, open]);

  // Solo se monta y desmonta con el componente: la identidad de la sesión se
  // resuelve dentro, así que resolverla no reabre el canal ni duplica el sondeo.
  useEffect(() => {
    if (usePusher) {
      let channel: Channel | null = null;
      let pusher: PusherClient | null = null;
      let cancelled = false;

      const setup = async () => {
        const id = await resolveUserId();
        if (cancelled || !id) {
          return;
        }
        const { default: Pusher } = await import("pusher-js");
        if (cancelled) {
          return;
        }
        pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY as string, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string,
          authEndpoint: "/api/notifications/pusher-auth",
        });
        channel = pusher.subscribe(`private-user-${id}`);
        channel.bind("notification", () => {
          void load();
        });
      };

      void setup();

      return () => {
        cancelled = true;
        if (channel) {
          channel.unbind_all();
        }
        if (pusher) {
          pusher.disconnect();
        }
      };
    }

    let stream: EventSource | null = null;
    if (typeof window !== "undefined" && "EventSource" in window) {
      stream = new EventSource("/api/notifications/stream");
      stream.addEventListener("notification", () => {
        void load();
      });
    }
    const intervalId = window.setInterval(() => {
      void load();
    }, NOTIFICATIONS_POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (stream) {
        stream.close();
      }
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load, resolveUserId, usePusher]);

  const grouped = useMemo(() => {
    const groups = {
      today: [] as NotificationItem[],
      yesterday: [] as NotificationItem[],
      week: [] as NotificationItem[],
      older: [] as NotificationItem[],
    };
    const startOfToday = startOfBusinessDay(new Date());
    if (!startOfToday) {
      return groups;
    }
    const startOfYesterday = addBusinessDays(startOfToday, -1) ?? startOfToday;
    const startOfWeek = addBusinessDays(startOfToday, -7) ?? startOfToday;

    for (const item of notifications) {
      const createdAt = new Date(item.createdAt);
      if (createdAt >= startOfToday) {
        groups.today.push(item);
      } else if (createdAt >= startOfYesterday) {
        groups.yesterday.push(item);
      } else if (createdAt >= startOfWeek) {
        groups.week.push(item);
      } else {
        groups.older.push(item);
      }
    }
    return groups;
  }, [notifications]);

  // Una baja local (marcar leída, borrar, limpiar) rebaja la referencia para que
  // la siguiente subida real vuelva a contar como novedad.
  useEffect(() => {
    if (unreadCount < previousUnreadRef.current) {
      previousUnreadRef.current = unreadCount;
    }
  }, [unreadCount]);

  // `load()` decide si hay novedad; aquí solo se anuncia, con el idioma vigente.
  // El ref evita repetir el aviso si cambia el diccionario o el idioma.
  useEffect(() => {
    if (!newUnreadAlert || announcedAlertIdRef.current === newUnreadAlert.id) {
      return;
    }
    announcedAlertIdRef.current = newUnreadAlert.id;
    const { item, count } = newUnreadAlert;
    const title = item
      ? getNotificationTitle(item.eventType, t)
      : t("userMenu.notifications");
    const body = item
      ? getNotificationDetail(item, locale, t)
      : t("userMenu.recent");
    emitNotificationSignal({ title, body });
    showLiveAlert(title, body);
    announce(
      count === 1
        ? t("layout.notifications.announceNewOne")
        : t("layout.notifications.announceNewMany", { count })
    );
  }, [announce, locale, newUnreadAlert, showLiveAlert, t]);

  const markAsRead = useCallback(
    async (item: NotificationItem) => {
      if (item.readAt) {
        return true;
      }
      try {
        markLocalMutation();
        const response = await fetch(`/api/notifications/${item.id}/read`, {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error(`Mark as read failed with status ${response.status}`);
        }
        setNotifications((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  readAt: new Date().toISOString(),
                }
              : entry
          )
        );
        setUnreadCount((current) => (current > 0 ? current - 1 : 0));
        return true;
      } catch {
        setActionError(t("layout.notifications.actionError"));
        return false;
      }
    },
    [markLocalMutation, t]
  );

  const openNotification = useCallback(
    async (item: NotificationItem) => {
      setActionError(null);
      const marked = await markAsRead(item);
      if (!marked && !item.link) {
        // Keep the panel open so the error stays visible.
        return;
      }
      setOpen(false);
      if (!item.link) {
        return;
      }
      if (isInternalLink(item.link)) {
        router.push(item.link);
        return;
      }
      window.location.href = item.link;
    },
    [markAsRead, router]
  );

  const handleDeleteNotification = useCallback(
    async (item: NotificationItem) => {
      if (deletingId) {
        return;
      }
      setActionError(null);
      setDeletingId(item.id);
      markLocalMutation();

      setNotifications((current) => current.filter((entry) => entry.id !== item.id));
      if (!item.readAt) {
        setUnreadCount((current) => (current > 0 ? current - 1 : 0));
      }

      try {
        const response = await fetch(`/api/notifications/${item.id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error(`Delete failed with status ${response.status}`);
        }
      } catch {
        // Reposición sobre el estado vigente: un sondeo pudo traer filas nuevas
        // mientras la petición estaba en vuelo.
        setNotifications((current) =>
          current.some((entry) => entry.id === item.id)
            ? current
            : [...current, item].sort(byCreatedDesc)
        );
        if (!item.readAt) {
          setUnreadCount((current) => current + 1);
        }
        setActionError(t("layout.notifications.actionError"));
      } finally {
        setDeletingId(null);
        setSwipeOffsets((current) => {
          if (!(item.id in current)) {
            return current;
          }
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      }
    },
    [deletingId, markLocalMutation, t]
  );

  const handleClearAll = useCallback(async () => {
    if (clearing) {
      return;
    }
    setActionError(null);
    setClearing(true);

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    // Antes del await: la recarga posterior no debe encontrar la caché vieja.
    markLocalMutation();
    setNotifications([]);
    setUnreadCount(0);
    setSwipeOffsets({});

    try {
      const response = await fetch("/api/notifications/clear", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Clear failed with status ${response.status}`);
      }
      await load({ silent: true });
    } catch {
      // Reposición sobre el estado vigente, sin pisar lo que llegara entretanto.
      setNotifications((current) => {
        const currentIds = new Set(current.map((entry) => entry.id));
        const restored = previousNotifications.filter(
          (entry) => !currentIds.has(entry.id)
        );
        return restored.length === 0
          ? current
          : [...current, ...restored].sort(byCreatedDesc);
      });
      setUnreadCount((current) => Math.max(current, previousUnreadCount));
      setActionError(t("layout.notifications.actionError"));
    } finally {
      setClearing(false);
    }
  }, [clearing, load, markLocalMutation, notifications, t, unreadCount]);

  const handleRowPointerDown = (
    itemId: string,
    event: PointerEvent<HTMLButtonElement>
  ) => {
    if (event.pointerType !== "touch") {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    rowSwipeRef.current = {
      id: itemId,
      startX: event.clientX,
      startY: event.clientY,
      isHorizontal: false,
      pointerId: event.pointerId,
    };
    setSwipeOffsets((current) => {
      if (Object.keys(current).length === 0) {
        return current;
      }
      const currentOffset = current[itemId] ?? 0;
      return currentOffset === 0 ? { [itemId]: 0 } : { [itemId]: currentOffset };
    });
  };

  const handleRowPointerMove = (
    itemId: string,
    event: PointerEvent<HTMLButtonElement>
  ) => {
    if (event.pointerType !== "touch") {
      return;
    }
    const start = rowSwipeRef.current;
    if (!start || start.id !== itemId || start.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;

    if (!start.isHorizontal) {
      if (Math.abs(dx) < 8) {
        return;
      }
      if (Math.abs(dx) <= Math.abs(dy)) {
        return;
      }
      start.isHorizontal = true;
    }

    if (event.cancelable) {
      event.preventDefault();
    }
    const offset = Math.max(ROW_SWIPE_MAX, Math.min(0, dx));
    setSwipeOffsets((current) => ({ ...current, [itemId]: offset }));
    if (Math.abs(offset) > 10) {
      rowSwipeConsumedIdRef.current = itemId;
    }
  };

  const handleRowPointerEnd = (
    item: NotificationItem,
    event: PointerEvent<HTMLButtonElement>
  ) => {
    if (event.pointerType !== "touch") {
      return;
    }
    const start = rowSwipeRef.current;
    if (!start || start.id !== item.id || start.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - start.startX;
    const offset = start.isHorizontal
      ? Math.max(ROW_SWIPE_MAX, Math.min(0, dx))
      : swipeOffsets[item.id] ?? 0;
    rowSwipeRef.current = null;
    if (offset <= ROW_SWIPE_OPEN_THRESHOLD) {
      setSwipeOffsets((current) => ({ ...current, [item.id]: ROW_SWIPE_MAX }));
      rowSwipeConsumedIdRef.current = item.id;
      return;
    }
    setSwipeOffsets((current) => ({ ...current, [item.id]: 0 }));
  };

  const alertTranslateY = (liveAlertVisible ? 0 : -22) + alertDragOffset;
  const alertOpacity = liveAlertVisible ? 1 : 0;
  const bellLabel =
    unreadCount > 0
      ? t("layout.notifications.bellLabel", { count: unreadCount })
      : t("layout.notifications.bellLabelEmpty");

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={bellButtonRef}
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "default"
          ) {
            void Notification.requestPermission();
          }
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-slate-600 transition hover:border-[var(--border-strong)]"
        aria-label={bellLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelRendered ? panelId : undefined}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sky-500"
          />
        ) : null}
      </button>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      {open && canUseDom && panelPlacement
        ? createPortal(
            <>
              <button
                type="button"
                aria-label={t("common.actions.close")}
                className="fixed inset-0 z-[1090] bg-slate-950/45 backdrop-blur-[1px]"
                onClick={closePanel}
              />
              <div
                ref={portalPanelRef}
                id={panelId}
                role="dialog"
                aria-modal="false"
                aria-labelledby={panelTitleId}
                tabIndex={-1}
                className="fixed z-[1100] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-contrast outline-none"
                style={{
                  top: panelPlacement.top,
                  left: panelPlacement.left,
                  width: panelPlacement.width,
                  maxHeight: panelPlacement.maxHeight,
                }}
              >
                <div className="border-b border-slate-100 bg-slate-50/75 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 id={panelTitleId} className="text-sm font-semibold text-slate-900">
                        {t("userMenu.notifications")}
                      </h2>
                      {loadFailed ? (
                        <p role="alert" className="mt-0.5 text-xs text-rose-600">
                          {t("layout.notifications.loadError")}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {unreadCount > 0
                            ? `${unreadCount} ${t("notifications.unread").toLowerCase()}`
                            : t("userMenu.empty")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <NotificationSoundToggle />
                      {loadFailed ? (
                        <button
                          type="button"
                          onClick={() => void load()}
                          disabled={loading}
                          className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-60"
                        >
                          {t("layout.notifications.retry")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleClearAll()}
                        disabled={
                          clearing ||
                          (unreadCount === 0 && notifications.length === 0)
                        }
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {clearing ? t("common.feedback.saving") : t("notifications.clear")}
                      </button>
                    </div>
                  </div>
                  {actionError ? (
                    <p role="alert" className="mt-2 text-xs text-rose-600">
                      {actionError}
                    </p>
                  ) : null}
                </div>

                {notifications.length === 0 && !loading && !loadFailed ? (
                  <div className="px-4 py-4 text-sm text-slate-600">
                    {t("userMenu.empty")}
                  </div>
                ) : (
                  <div
                    className="overflow-y-auto bg-white text-sm text-slate-600"
                    style={{ maxHeight: Math.max(160, panelPlacement.maxHeight - 74) }}
                  >
                    {(["today", "yesterday", "week", "older"] as const).map(
                      (groupKey) =>
                        grouped[groupKey].length > 0 ? (
                          <div
                            key={groupKey}
                            className="border-t border-slate-100 first:border-t-0"
                          >
                            <div className="px-4 py-2 text-[11px] font-medium text-slate-500">
                              {t(`notifications.group.${groupKey}`)}
                            </div>
                            <div className="space-y-2 px-2 pb-2">
                              {grouped[groupKey].map((item) => {
                                const isRead = Boolean(item.readAt);
                                const title = getNotificationTitle(item.eventType, t);
                                const detail = getNotificationDetail(item, locale, t);
                                const offset = swipeOffsets[item.id] ?? 0;
                                const timeLabel = formatRelativeDate(item.createdAt, locale);
                                const railOpen = offset <= ROW_SWIPE_OPEN_THRESHOLD;
                                const railArmed = offset <= ROW_SWIPE_DELETE_THRESHOLD;
                                const source = getNotificationSource(item, t);
                                const deleteLabel = t("layout.notifications.deleteItem", {
                                  source,
                                });

                                return (
                                  <div
                                    key={item.id}
                                    className="relative overflow-hidden rounded-xl border border-slate-200 bg-white"
                                  >
                                    <div
                                      aria-hidden={!railOpen}
                                      className={`absolute inset-y-0 right-0 flex w-[92px] items-center justify-center border-l border-rose-200 bg-rose-50 px-2 transition-opacity duration-150 md:hidden ${
                                        railOpen
                                          ? "opacity-100 pointer-events-auto"
                                          : "opacity-0 pointer-events-none"
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        tabIndex={railOpen ? 0 : -1}
                                        aria-label={deleteLabel}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleDeleteNotification(item);
                                        }}
                                        disabled={deletingId === item.id}
                                        className={`inline-flex min-h-8 items-center justify-center rounded-full px-3 text-xs font-semibold text-white transition disabled:opacity-60 ${
                                          railArmed
                                            ? "bg-rose-600 hover:bg-rose-700"
                                            : "bg-rose-500 hover:bg-rose-600"
                                        }`}
                                      >
                                        {t("common.actions.delete")}
                                      </button>
                                    </div>

                                    <div
                                      style={{
                                        transform: `translateX(${offset}px)`,
                                        transition:
                                          rowSwipeRef.current?.id === item.id
                                            ? "none"
                                            : "transform 180ms ease",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onPointerDown={(event) =>
                                          handleRowPointerDown(item.id, event)
                                        }
                                        onPointerMove={(event) =>
                                          handleRowPointerMove(item.id, event)
                                        }
                                        onPointerUp={(event) =>
                                          handleRowPointerEnd(item, event)
                                        }
                                        onPointerCancel={(event) =>
                                          handleRowPointerEnd(item, event)
                                        }
                                        onClick={() => {
                                          if (rowSwipeConsumedIdRef.current === item.id) {
                                            rowSwipeConsumedIdRef.current = null;
                                            if ((swipeOffsets[item.id] ?? 0) < 0) {
                                              setSwipeOffsets((current) => ({
                                                ...current,
                                                [item.id]: 0,
                                              }));
                                            }
                                            return;
                                          }
                                          if (railOpen) {
                                            setSwipeOffsets((current) => ({
                                              ...current,
                                              [item.id]: 0,
                                            }));
                                            return;
                                          }
                                          void openNotification(item);
                                        }}
                                        data-severity={item.severity ?? "INFO"}
                                        className={`notification-item relative w-full px-3 py-3 text-left transition sm:px-4 ${
                                          isRead
                                            ? "bg-white hover:bg-slate-50"
                                            : "bg-sky-50 hover:bg-sky-100/80"
                                        }`}
                                        style={{ touchAction: "pan-y" }}
                                      >
                                        <div className="flex items-start gap-3 pr-8 sm:justify-between">
                                          <div className="min-w-0 flex-1">
                                            <p className="break-words text-sm font-semibold text-slate-900 sm:truncate">
                                              {source}
                                            </p>
                                            <p className="mt-0.5 break-words text-xs text-slate-500 sm:truncate">
                                              {detail}
                                            </p>
                                          </div>
                                          <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">
                                            {timeLabel}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-[11px] text-slate-400 sm:hidden">
                                          {timeLabel}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                            {title}
                                          </span>
                                          {!isRead ? (
                                            <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                                              {t("notifications.unread")}
                                            </span>
                                          ) : null}
                                        </div>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleDeleteNotification(item);
                                        }}
                                        disabled={deletingId === item.id}
                                        className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-60 max-md:pointer-events-none max-md:opacity-0 max-md:focus-visible:pointer-events-auto max-md:focus-visible:opacity-100"
                                        aria-label={deleteLabel}
                                        title={t("common.actions.delete")}
                                      >
                                        <CloseIcon />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null
                    )}
                  </div>
                )}
              </div>
            </>,
            document.body
          )
        : null}

      {liveAlert && canUseDom
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[1200] px-2 sm:left-1/2 sm:right-auto sm:top-[calc(env(safe-area-inset-top)+0.75rem)] sm:w-[min(94vw,34rem)] sm:-translate-x-1/2 sm:px-0">
              <div
                role="status"
                className="pointer-events-auto rounded-xl border border-sky-200 bg-white/95 px-3 py-2.5 shadow-contrast backdrop-blur sm:rounded-2xl sm:px-4 sm:py-3"
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  if (!touch) return;
                  alertSwipeStartYRef.current = touch.clientY;
                }}
                onTouchMove={(event) => {
                  const touch = event.touches[0];
                  if (!touch) return;
                  const startY = alertSwipeStartYRef.current;
                  if (startY == null) {
                    return;
                  }
                  const delta = Math.max(-140, Math.min(0, touch.clientY - startY));
                  setAlertDragOffset(delta);
                  if (event.cancelable) {
                    event.preventDefault();
                  }
                }}
                onTouchEnd={() => {
                  const delta = alertDragOffset;
                  alertSwipeStartYRef.current = null;
                  if (delta <= ALERT_SWIPE_CLOSE_THRESHOLD) {
                    dismissLiveAlert();
                  } else {
                    setAlertDragOffset(0);
                  }
                }}
                style={{
                  transform: `translateY(${alertTranslateY}px)`,
                  opacity: alertOpacity,
                  touchAction: "none",
                  transition: alertSwipeStartYRef.current
                    ? "none"
                    : "transform 220ms ease, opacity 220ms ease",
                }}
              >
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {t("userMenu.notifications")}
                      </p>
                      <button
                        type="button"
                        onClick={() => dismissLiveAlert()}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        aria-label={t("common.actions.close")}
                      >
                        <CloseIcon />
                      </button>
                    </div>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                      {liveAlert.title}
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-600">{liveAlert.body}</p>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
