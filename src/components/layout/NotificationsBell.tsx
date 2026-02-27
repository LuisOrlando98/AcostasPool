"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import {
  getNotificationDetail,
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

export default function NotificationsBell() {
  const { t, locale } = useI18n();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [revealedDeleteId, setRevealedDeleteId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [swipeState, setSwipeState] = useState<{ id: string; offset: number } | null>(
    null
  );
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousUnreadRef = useRef(0);
  const initializedRef = useRef(false);
  const swipeStartRef = useRef<{ id: string; startX: number } | null>(null);
  const swipedRef = useRef(false);
  const usePusher =
    Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_PUSHER_CLUSTER);
  const SWIPE_ACTION_WIDTH = 88;
  const SWIPE_OPEN_THRESHOLD = 56;

  const load = useCallback(async () => {
    const unreadRes = await fetch("/api/notifications/unread");
    const unreadData = await unreadRes.json().catch(() => ({ unread: 0 }));
    setUnreadCount(
      typeof unreadData.unread === "number" ? unreadData.unread : 0
    );

    const notificationsRes = await fetch("/api/notifications/recent");
    const notificationsData = await notificationsRes
      .json()
      .catch(() => ({ notifications: [] }));
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
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
        setRevealedDeleteId(null);
        setConfirmDeleteId(null);
        setSwipeState(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      setRevealedDeleteId(null);
      setConfirmDeleteId(null);
      setSwipeState(null);
    }
  }, [open]);

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
        channel.bind("notification", () => load());
      };

      setup();

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
      const intervalId = window.setInterval(() => {
        load();
      }, 20000);
      const onVisibilityChange = () => {
        if (!document.hidden) {
          load();
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => {
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
    }

    previousUnreadRef.current = unreadCount;
  }, [locale, notifications, t, unreadCount]);

  const handleDeleteNotification = useCallback(
    async (item: NotificationItem) => {
      if (confirmDeleteId !== item.id) {
        setConfirmDeleteId(item.id);
        return;
      }
      const response = await fetch(`/api/notifications/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        return;
      }
      setNotifications((current) =>
        current.filter((entry) => entry.id !== item.id)
      );
      if (!item.readAt) {
        setUnreadCount((current) => (current > 0 ? current - 1 : 0));
      }
      setConfirmDeleteId(null);
      setRevealedDeleteId(null);
      setSwipeState(null);
    },
    [confirmDeleteId]
  );

  const handleSwipeStart = (itemId: string, clientX: number) => {
    swipeStartRef.current = { id: itemId, startX: clientX };
    swipedRef.current = false;
    if (revealedDeleteId && revealedDeleteId !== itemId) {
      setRevealedDeleteId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleSwipeMove = (itemId: string, clientX: number) => {
    const start = swipeStartRef.current;
    if (!start || start.id !== itemId) {
      return;
    }
    const delta = Math.max(
      0,
      Math.min(SWIPE_ACTION_WIDTH, clientX - start.startX)
    );
    if (delta > 8) {
      swipedRef.current = true;
    }
    setSwipeState({ id: itemId, offset: delta });
  };

  const handleSwipeEnd = (itemId: string) => {
    const isActive = swipeState?.id === itemId;
    const offset = isActive ? swipeState.offset : 0;
    if (offset >= SWIPE_OPEN_THRESHOLD) {
      setRevealedDeleteId(itemId);
      setConfirmDeleteId(null);
    } else if (revealedDeleteId === itemId) {
      setRevealedDeleteId(null);
      setConfirmDeleteId(null);
    }
    setSwipeState(null);
    swipeStartRef.current = null;
  };

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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.25 18.75a2.25 2.25 0 01-4.5 0m9-3.75V11.25a6.75 6.75 0 10-13.5 0V15L3 17.25h18l-2.25-2.25z"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sky-500" />
        ) : null}
      </button>

      {open ? (
        <div className="fixed left-3 right-3 top-[5.2rem] z-[1100] max-h-[78vh] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-contrast sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:z-auto sm:mt-3 sm:w-80 sm:max-h-[34rem]">
          <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
            <span>{t("userMenu.recent")}</span>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/notifications/clear", { method: "POST" });
                setNotifications((current) =>
                  current.map((entry) => ({
                    ...entry,
                    readAt: entry.readAt ?? new Date().toISOString(),
                  }))
                );
                setUnreadCount(0);
              }}
              className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            >
              {t("notifications.clear")}
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 pb-4 text-sm text-slate-600">
              {t("userMenu.empty")}
            </div>
          ) : (
            <div className="max-h-[calc(78vh-3.2rem)] overflow-y-auto text-sm text-slate-600 sm:max-h-[29rem]">
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
                          const isSwiping = swipeState?.id === item.id;
                          const translateX =
                            swipeState?.id === item.id
                              ? swipeState.offset
                              : revealedDeleteId === item.id
                                ? SWIPE_ACTION_WIDTH
                                : 0;
                          return (
                            <div key={item.id} className="relative overflow-hidden">
                              <div
                                className={`absolute inset-y-0 left-0 flex w-[88px] items-center justify-center bg-rose-600 px-2 text-white transition ${
                                  translateX > 0 ? "opacity-100" : "opacity-0"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNotification(item)}
                                  className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition hover:bg-white/20"
                                  aria-label={
                                    confirmDeleteId === item.id
                                      ? t("notifications.deleteConfirm")
                                      : t("common.actions.delete")
                                  }
                                >
                                  {confirmDeleteId === item.id
                                    ? t("notifications.deleteConfirm")
                                    : t("common.actions.delete")}
                                </button>
                              </div>
                              <button
                                type="button"
                                onPointerDown={(event) => {
                                  if (event.pointerType !== "touch") {
                                    return;
                                  }
                                  handleSwipeStart(item.id, event.clientX);
                                }}
                                onPointerMove={(event) => {
                                  if (event.pointerType !== "touch") {
                                    return;
                                  }
                                  handleSwipeMove(item.id, event.clientX);
                                }}
                                onPointerUp={(event) => {
                                  if (event.pointerType !== "touch") {
                                    return;
                                  }
                                  handleSwipeEnd(item.id);
                                }}
                                onPointerCancel={() => {
                                  handleSwipeEnd(item.id);
                                }}
                                onClick={async () => {
                                  if (swipedRef.current) {
                                    swipedRef.current = false;
                                    return;
                                  }
                                  if (revealedDeleteId === item.id) {
                                    setRevealedDeleteId(null);
                                    setConfirmDeleteId(null);
                                    return;
                                  }
                                  if (!isRead) {
                                    await fetch(`/api/notifications/${item.id}/read`, {
                                      method: "POST",
                                    });
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
                                    setUnreadCount((current) =>
                                      current > 0 ? current - 1 : 0
                                    );
                                  }
                                  setOpen(false);
                                  if (item.link) {
                                    window.location.href = item.link;
                                  }
                                }}
                                data-severity={item.severity ?? "INFO"}
                                className={`notification-item w-full px-4 py-3 text-left transition ${
                                  isRead
                                    ? "bg-white hover:bg-slate-50"
                                    : "bg-slate-50/80 hover:bg-slate-50"
                                }`}
                                style={{
                                  transform: `translateX(${translateX}px)`,
                                  transition: isSwiping
                                    ? "none"
                                    : "transform 180ms ease",
                                  touchAction: "pan-y",
                                }}
                              >
                                <div className="flex items-center justify-between text-xs text-slate-400">
                                  <span className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    {title}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
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
                                  {item.customerName ?? t("userMenu.system")}
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {detail}
                                </div>
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
      ) : null}
    </div>
  );
}
