"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/client";
import {
  getNotificationDetail,
  getNotificationSource,
  getNotificationTitle,
} from "@/lib/notifications/view";
import { emitNotificationSignal } from "@/lib/notifications/client-alert";

type NotificationItem = {
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
const ROW_SWIPE_DELETE_THRESHOLD = -56;
const ROW_SWIPE_MAX = -92;

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
  return date.toLocaleString(locale, {
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
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [liveAlert, setLiveAlert] = useState<LiveAlert | null>(null);
  const [liveAlertVisible, setLiveAlertVisible] = useState(false);
  const [alertDragOffset, setAlertDragOffset] = useState(0);
  const [panelPlacement, setPanelPlacement] = useState<PanelPlacement | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});

  const panelRef = useRef<HTMLDivElement | null>(null);
  const portalPanelRef = useRef<HTMLDivElement | null>(null);
  const bellButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousUnreadRef = useRef(0);
  const initializedRef = useRef(false);
  const alertAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertSwipeStartYRef = useRef<number | null>(null);
  const rowSwipeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    isHorizontal: boolean;
  } | null>(null);
  const rowSwipeConsumedIdRef = useRef<string | null>(null);

  const usePusher =
    Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_PUSHER_CLUSTER);
  const canUseDom =
    typeof window !== "undefined" && typeof document !== "undefined";

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
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cacheBust = Date.now().toString();
      const [unreadRes, notificationsRes] = await Promise.all([
        fetch(`/api/notifications/unread?cb=${cacheBust}`, { cache: "no-store" }),
        fetch(`/api/notifications/recent?cb=${cacheBust}`, { cache: "no-store" }),
      ]);
      const unreadData = await unreadRes.json().catch(() => ({ unread: 0 }));
      const notificationsData = await notificationsRes
        .json()
        .catch(() => ({ notifications: [] }));

      setUnreadCount(
        typeof unreadData.unread === "number" ? unreadData.unread : 0
      );
      const resolved = Array.isArray(notificationsData.notifications)
        ? (notificationsData.notifications as NotificationItem[])
        : [];
      setNotifications([...resolved].sort(byCreatedDesc));

      if (!userId) {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        const meData = await meRes.json().catch(() => ({ user: null }));
        if (meData?.user?.id) {
          setUserId(meData.user.id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
    if (usePusher && userId) {
      let channel: any;
      let pusher: any;
      let cancelled = false;

      const setup = async () => {
        const { default: Pusher } = await import("pusher-js");
        if (cancelled) {
          return;
        }
        pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY as string, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string,
          authEndpoint: "/api/notifications/pusher-auth",
        });
        channel = pusher.subscribe(`private-user-${userId}`);
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

    if (!usePusher) {
      let stream: EventSource | null = null;
      if (typeof window !== "undefined" && "EventSource" in window) {
        stream = new EventSource("/api/notifications/stream");
        stream.addEventListener("notification", () => {
          void load();
        });
      }
      const intervalId = window.setInterval(() => {
        void load();
      }, 20000);
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
    }

    return undefined;
  }, [load, usePusher, userId]);

  const grouped = useMemo(() => {
    const groups = {
      today: [] as NotificationItem[],
      yesterday: [] as NotificationItem[],
      week: [] as NotificationItem[],
      older: [] as NotificationItem[],
    };
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);

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

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      previousUnreadRef.current = unreadCount;
      return;
    }

    if (unreadCount > previousUnreadRef.current) {
      const latestUnread = notifications.find((item) => !item.readAt);
      const title = latestUnread
        ? getNotificationTitle(latestUnread.eventType, t)
        : t("userMenu.notifications");
      const body = latestUnread
        ? getNotificationDetail(latestUnread, locale, t)
        : t("userMenu.recent");
      emitNotificationSignal({ title, body });
      showLiveAlert(title, body);
    }

    previousUnreadRef.current = unreadCount;
  }, [locale, notifications, showLiveAlert, t, unreadCount]);

  const markAsRead = useCallback(async (item: NotificationItem) => {
    if (item.readAt) {
      return;
    }
    const response = await fetch(`/api/notifications/${item.id}/read`, {
      method: "POST",
    });
    if (!response.ok) {
      return;
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
  }, []);

  const openNotification = useCallback(
    async (item: NotificationItem) => {
      setActionError(null);
      await markAsRead(item);
      setOpen(false);
      if (item.link) {
        window.location.href = item.link;
      }
    },
    [markAsRead]
  );

  const handleDeleteNotification = useCallback(
    async (item: NotificationItem) => {
      if (deletingId) {
        return;
      }
      setActionError(null);
      setDeletingId(item.id);
      const previousNotifications = notifications;
      const previousUnreadCount = unreadCount;

      setNotifications((current) => current.filter((entry) => entry.id !== item.id));
      if (!item.readAt) {
        setUnreadCount((current) => (current > 0 ? current - 1 : 0));
      }

      const response = await fetch(`/api/notifications/${item.id}`, {
        method: "DELETE",
      }).catch(() => null);

      if (!response?.ok) {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
        setActionError(t("notifications.preferences.saveError"));
      }

      setDeletingId(null);
      setSwipeOffsets((current) => {
        if (!(item.id in current)) {
          return current;
        }
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    },
    [deletingId, notifications, t, unreadCount]
  );

  const handleClearAll = useCallback(async () => {
    if (clearing) {
      return;
    }
    setActionError(null);
    setClearing(true);

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    setNotifications([]);
    setUnreadCount(0);
    setSwipeOffsets({});

    const response = await fetch("/api/notifications/clear", {
      method: "POST",
    }).catch(() => null);

    if (!response?.ok) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setActionError(t("notifications.preferences.saveError"));
      setClearing(false);
      return;
    }

    await load();
    setClearing(false);
  }, [clearing, load, notifications, t, unreadCount]);

  const handleRowTouchStart = (itemId: string, touch: Touch) => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      return;
    }
    rowSwipeRef.current = {
      id: itemId,
      startX: touch.clientX,
      startY: touch.clientY,
      isHorizontal: false,
    };
  };

  const handleRowTouchMove = (itemId: string, event: TouchEvent<HTMLButtonElement>) => {
    const start = rowSwipeRef.current;
    if (!start || start.id !== itemId) {
      return;
    }
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    const dx = touch.clientX - start.startX;
    const dy = touch.clientY - start.startY;

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

  const handleRowTouchEnd = (item: NotificationItem) => {
    const offset = swipeOffsets[item.id] ?? 0;
    rowSwipeRef.current = null;
    if (offset <= ROW_SWIPE_DELETE_THRESHOLD) {
      rowSwipeConsumedIdRef.current = item.id;
      void handleDeleteNotification(item);
      return;
    }
    setSwipeOffsets((current) => ({ ...current, [item.id]: 0 }));
  };

  const alertTranslateY = (liveAlertVisible ? 0 : -22) + alertDragOffset;
  const alertOpacity = liveAlertVisible ? 1 : 0;

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
        aria-label={t("userMenu.notifications")}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sky-500" />
        ) : null}
      </button>

      {open && canUseDom && panelPlacement
        ? createPortal(
            <>
              <button
                type="button"
                aria-label={t("common.actions.close")}
                className="fixed inset-0 z-[1090] bg-slate-950/45 backdrop-blur-[1px]"
                onClick={() => setOpen(false)}
              />
              <div
                ref={portalPanelRef}
                className="fixed z-[1100] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-contrast"
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
                      <p className="text-sm font-semibold text-slate-900">
                        {t("userMenu.notifications")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {unreadCount > 0
                          ? `${unreadCount} ${t("notifications.unread").toLowerCase()}`
                          : t("userMenu.empty")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleClearAll()}
                      disabled={clearing || notifications.length === 0}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {clearing ? t("common.feedback.saving") : t("notifications.clear")}
                    </button>
                  </div>
                  {actionError ? (
                    <p className="mt-2 text-xs text-rose-600">{actionError}</p>
                  ) : null}
                </div>

                {notifications.length === 0 && !loading ? (
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

                                return (
                                  <div
                                    key={item.id}
                                    className="relative overflow-hidden rounded-xl border border-slate-200 bg-white"
                                  >
                                    <div className="absolute inset-y-0 right-0 flex w-[92px] items-center justify-center bg-rose-600 px-2 text-white">
                                      <span className="text-[11px] font-semibold">
                                        {t("common.actions.delete")}
                                      </span>
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
                                        onTouchStart={(event) => {
                                          const touch = event.touches[0];
                                          if (!touch) return;
                                          handleRowTouchStart(item.id, touch);
                                        }}
                                        onTouchMove={(event) => handleRowTouchMove(item.id, event)}
                                        onTouchEnd={() => handleRowTouchEnd(item)}
                                        onClick={() => {
                                          if (rowSwipeConsumedIdRef.current === item.id) {
                                            rowSwipeConsumedIdRef.current = null;
                                            return;
                                          }
                                          void openNotification(item);
                                        }}
                                        data-severity={item.severity ?? "INFO"}
                                        className={`notification-item relative w-full px-4 py-3 text-left transition ${
                                          isRead
                                            ? "bg-white hover:bg-slate-50"
                                            : "bg-sky-50/40 hover:bg-sky-50/60"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3 pr-8">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900">
                                              {getNotificationSource(item, t)}
                                            </p>
                                            <p className="truncate text-xs text-slate-500">
                                              {detail}
                                            </p>
                                          </div>
                                          <span className="shrink-0 text-[11px] text-slate-400">
                                            {timeLabel}
                                          </span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
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
                                        className="absolute right-3 top-3 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-60 md:inline-flex"
                                        aria-label={t("common.actions.delete")}
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
            <div className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[1200] w-[min(94vw,34rem)] -translate-x-1/2 px-1">
              <div
                className="pointer-events-auto rounded-2xl border border-sky-200 bg-white/95 px-4 py-3 shadow-contrast backdrop-blur"
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
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t("userMenu.notifications")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {liveAlert.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{liveAlert.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissLiveAlert()}
                    className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 md:inline-flex"
                    aria-label={t("common.actions.close")}
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
