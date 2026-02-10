"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";

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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const usePusher =
    Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_PUSHER_CLUSTER);

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
      const source = new EventSource("/api/notifications/stream");
      const onNotification = () => {
        load();
      };
      source.addEventListener("notification", onNotification);
      source.addEventListener("error", () => {
        // Let the browser retry automatically.
      });
      return () => {
        source.removeEventListener("notification", onNotification);
        source.close();
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

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
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
        <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-contrast">
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
            <div className="text-sm text-slate-600">
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
                          const payload =
                            item.payload && typeof item.payload === "object"
                              ? (item.payload as Record<string, unknown>)
                              : {};
                          const isRead = Boolean(item.readAt);
                          const titleMap: Record<string, string> = {
                            JOB_COMPLETED: t("notifications.jobCompleted"),
                            CUSTOMER_REQUEST: t("notifications.customerRequest"),
                            SERVICE_SCHEDULED: t("notifications.serviceScheduled"),
                            SERVICE_RESCHEDULED: t(
                              "notifications.serviceRescheduled"
                            ),
                            ROUTE_UPDATED: t("notifications.routeUpdated"),
                            INVOICE_SENT: t("notifications.invoiceSent"),
                          };
                          const title =
                            titleMap[item.eventType] ??
                            item.eventType.replaceAll("_", " ");
                          const techName =
                            typeof payload.technicianName === "string"
                              ? payload.technicianName
                              : null;
                          const completedAt =
                            typeof payload.completedAt === "string"
                              ? payload.completedAt
                              : null;
                          const requestedAt =
                            typeof payload.requestedAt === "string"
                              ? payload.requestedAt
                              : null;
                          const reason =
                            typeof payload.reason === "string"
                              ? payload.reason
                              : null;
                          const detail =
                            item.eventType === "JOB_COMPLETED"
                              ? `${techName ?? t("userMenu.system")} - ${new Date(
                                  completedAt ?? item.createdAt
                                ).toLocaleTimeString(locale, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}`
                              : item.eventType === "CUSTOMER_REQUEST"
                                ? `${t("notifications.requested")} - ${new Date(
                                    requestedAt ?? item.createdAt
                                  ).toLocaleString(locale, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}${reason ? ` - ${reason}` : ""}`
                                : new Date(item.createdAt).toLocaleString(locale, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  });
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={async () => {
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
