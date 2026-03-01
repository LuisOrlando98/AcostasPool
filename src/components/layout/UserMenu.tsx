"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { getAssetUrl } from "@/lib/assets";
import InstallAppAction from "@/components/pwa/InstallAppAction";
import {
  getNotificationDetail,
  getNotificationSource,
  getNotificationTitle,
} from "@/lib/notifications/view";
import { emitNotificationSignal } from "@/lib/notifications/client-alert";

type UserInfo = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  isDeveloper?: boolean;
};

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

export default function UserMenu() {
  const { t, locale } = useI18n();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);
  const previousUnreadRef = useRef(0);
  const initializedRef = useRef(false);
  const usePusher =
    Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_PUSHER_CLUSTER);

  const load = useCallback(async () => {
    const [userRes, unreadRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/notifications/unread"),
    ]);

    const userData = await userRes.json().catch(() => ({ user: null }));
    setUser(userData.user);

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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setOpenNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(target)) {
        setOpenUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (usePusher && user?.id) {
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
        channel = pusher.subscribe(`private-user-${user.id}`);
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
  }, [load, usePusher, user?.id]);

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

  const handleLogout = async () => {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };
  const accountHref = user?.role === "CUSTOMER" ? "/client/profile" : "/account";
  const isAdmin = user?.role === "ADMIN";

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AP";

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={notificationsRef}>
        <button
          type="button"
          onClick={() => {
            setOpenNotifications((value) => !value);
            setOpenUserMenu(false);
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
        {openNotifications ? (
          <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-contrast">
            <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
              <span>{t("userMenu.recent")}</span>
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/notifications/clear", { method: "POST" });
                  setNotifications([]);
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
                            const isRead = Boolean(item.readAt);
                            const title = getNotificationTitle(item.eventType, t);
                            const detail = getNotificationDetail(item, locale, t);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={async () => {
                                  if (!isRead) {
                                    await fetch(
                                      `/api/notifications/${item.id}/read`,
                                      {
                                        method: "POST",
                                      }
                                    );
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
                                  setOpenNotifications(false);
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
                                  {getNotificationSource(item, t)}
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

      <div className="relative" ref={userRef}>
        <button
          type="button"
          onClick={() => {
            setOpenUserMenu((value) => !value);
            setOpenNotifications(false);
          }}
          className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-[var(--border-strong)]"
          aria-label={t("common.navigation.menu")}
        >
          <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-[10px] font-semibold text-white">
            {user?.avatarUrl ? (
              <img
                src={getAssetUrl(user.avatarUrl)}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </span>
          <span className="hidden sm:inline">
            {user?.name ?? t("userMenu.fallbackUser")}
          </span>
        </button>
        {openUserMenu ? (
          <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-contrast">
            <div className="px-4 py-3 text-xs text-slate-500">
              {user?.role ?? t("userMenu.role")}
            </div>
            <div className="px-4 pb-3 text-xs text-slate-400">
              {user?.email ?? ""}
            </div>
            <a
              href={accountHref}
              className="block border-t border-[var(--border)] px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              {t("userMenu.account")}
            </a>
            {isAdmin ? (
              <a
                href="/account/updates"
                className="block border-t border-[var(--border)] px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                {t("userMenu.updates")}
              </a>
            ) : null}
            <InstallAppAction variant="menu" />
            {user?.isDeveloper ? (
              <a
                href="/admin/developer"
                className="block border-t border-[var(--border)] px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                Developer Console
              </a>
            ) : null}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="w-full border-t border-[var(--border)] px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              {loading ? t("userMenu.signingOut") : t("userMenu.signOut")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
