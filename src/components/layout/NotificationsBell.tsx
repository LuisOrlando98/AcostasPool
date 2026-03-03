"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const ALERT_AUTO_CLOSE_MS = 4000;
const ALERT_HIDE_DURATION_MS = 220;
const ALERT_SWIPE_CLOSE_THRESHOLD = -60;

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

  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousUnreadRef = useRef(0);
  const initializedRef = useRef(false);
  const alertSwipeStartYRef = useRef<number | null>(null);
  const alertAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const [unreadRes, notificationsRes] = await Promise.all([
        fetch("/api/notifications/unread"),
        fetch("/api/notifications/recent"),
      ]);
      const unreadData = await unreadRes.json().catch(() => ({ unread: 0 }));
      const notificationsData = await notificationsRes
        .json()
        .catch(() => ({ notifications: [] }));

      setUnreadCount(
        typeof unreadData.unread === "number" ? unreadData.unread : 0
      );
      setNotifications(
        Array.isArray(notificationsData.notifications)
          ? notificationsData.notifications
          : []
      );

      if (!userId) {
        const meRes = await fetch("/api/auth/me");
        const meData = await meRes.json().catch(() => ({ user: null }));
        if (meData?.user?.id) {
          setUserId(meData.user.id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        stream.addEventListener("error", () => undefined);
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

  const markAsRead = useCallback(
    async (item: NotificationItem) => {
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
    },
    []
  );

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
    },
    [deletingId, notifications, t, unreadCount]
  );

  const handleClearAll = useCallback(async () => {
    if (clearing) {
      return;
    }
    setActionError(null);
    setClearing(true);
    const response = await fetch("/api/notifications/clear", {
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) {
      setActionError(t("notifications.preferences.saveError"));
      setClearing(false);
      return;
    }
    await load();
    setClearing(false);
  }, [clearing, load, t]);

  const alertTranslateY = (liveAlertVisible ? 0 : -22) + alertDragOffset;
  const alertOpacity = liveAlertVisible ? 1 : 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
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

      {open && canUseDom
        ? createPortal(
            <>
              <button
                type="button"
                aria-label={t("common.actions.close")}
                className="fixed inset-0 z-[1090] bg-slate-950/45 backdrop-blur-[1px]"
                onClick={() => setOpen(false)}
              />
              <div className="fixed left-3 right-3 top-[5.2rem] z-[1100] max-h-[78vh] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-contrast sm:left-auto sm:right-4 sm:w-[22rem] sm:max-h-[34rem]">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t("userMenu.notifications")}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {t("notifications.preferences.enabledCount", {
                          enabled: String(unreadCount),
                          total: String(notifications.length),
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleClearAll()}
                      disabled={clearing || notifications.length === 0}
                      className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:opacity-60"
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
                  <div className="max-h-[calc(78vh-5.25rem)] overflow-y-auto text-sm text-slate-600 sm:max-h-[28rem]">
                    {(["today", "yesterday", "week", "older"] as const).map(
                      (groupKey) =>
                        grouped[groupKey].length > 0 ? (
                          <div
                            key={groupKey}
                            className="border-t border-slate-100 first:border-t-0"
                          >
                            <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {t(`notifications.group.${groupKey}`)}
                            </div>
                            <div className="divide-y divide-slate-100">
                              {grouped[groupKey].map((item) => {
                                const isRead = Boolean(item.readAt);
                                const title = getNotificationTitle(item.eventType, t);
                                const detail = getNotificationDetail(item, locale, t);
                                return (
                                  <div
                                    key={item.id}
                                    data-severity={item.severity ?? "INFO"}
                                    className={`notification-item relative px-4 py-3 transition ${
                                      isRead
                                        ? "bg-white hover:bg-slate-50"
                                        : "bg-slate-50/80 hover:bg-slate-50"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => void openNotification(item)}
                                      className="w-full pr-8 text-left"
                                    >
                                      <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                                          {title}
                                        </span>
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                            isRead
                                              ? "bg-slate-100 text-slate-500"
                                              : "bg-sky-100 text-sky-700"
                                          }`}
                                        >
                                          {isRead
                                            ? t("notifications.read")
                                            : t("notifications.unread")}
                                        </span>
                                      </div>
                                      <div className="mt-2 text-sm font-semibold text-slate-700">
                                        {getNotificationSource(item, t)}
                                      </div>
                                      <div className="mt-1 text-[11px] text-slate-500">
                                        {detail}
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleDeleteNotification(item);
                                      }}
                                      disabled={deletingId === item.id}
                                      className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-60"
                                      aria-label={t("common.actions.delete")}
                                      title={t("common.actions.delete")}
                                    >
                                      <CloseIcon />
                                    </button>
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
            <div className="pointer-events-none fixed left-1/2 top-3 z-[1200] w-[min(94vw,34rem)] -translate-x-1/2 px-1">
              <div
                className="pointer-events-auto rounded-2xl border border-sky-200 bg-white/95 px-4 py-3 shadow-contrast backdrop-blur"
                onPointerDown={(event) => {
                  if (event.pointerType !== "touch") {
                    return;
                  }
                  alertSwipeStartYRef.current = event.clientY;
                }}
                onPointerMove={(event) => {
                  if (event.pointerType !== "touch") {
                    return;
                  }
                  const startY = alertSwipeStartYRef.current;
                  if (startY == null) {
                    return;
                  }
                  const delta = Math.max(-140, Math.min(0, event.clientY - startY));
                  setAlertDragOffset(delta);
                }}
                onPointerUp={(event) => {
                  if (event.pointerType === "touch") {
                    const delta = alertDragOffset;
                    alertSwipeStartYRef.current = null;
                    if (delta <= ALERT_SWIPE_CLOSE_THRESHOLD) {
                      dismissLiveAlert();
                    } else {
                      setAlertDragOffset(0);
                    }
                  }
                }}
                onPointerCancel={() => {
                  alertSwipeStartYRef.current = null;
                  setAlertDragOffset(0);
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
