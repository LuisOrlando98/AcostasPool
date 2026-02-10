"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { getAssetUrl } from "@/lib/assets";

type UserInfo = {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
};

export default function SidebarAccount() {
  const { t } = useI18n();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/auth/me");
      const data = await res.json().catch(() => ({ user: null }));
      setUser(data.user ?? null);
    };
    load();
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AP";

  const handleLogout = async () => {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="sidebar-account-card">
      <div className="sidebar-account-header">
        <span className="sidebar-account-avatar">
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
        <div className="sidebar-account-text">
          <p className="sidebar-account-name">
            {user?.name ?? t("userMenu.fallbackUser")}
          </p>
          <p className="sidebar-account-email">{user?.email ?? ""}</p>
        </div>
      </div>
      <div className="sidebar-account-actions">
        <a href="/account" className="sidebar-account-link">
          <span className="sidebar-account-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.5 18c0-2.6 2.6-4.5 5.5-4.5S17.5 15.4 17.5 18"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.5 9.5a3.5 3.5 0 117 0 3.5 3.5 0 00-7 0z"
              />
            </svg>
          </span>
          <span className="sidebar-account-label">{t("userMenu.account")}</span>
        </a>
        <a href="/account/updates" className="sidebar-account-link">
          <span className="sidebar-account-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7h16M4 12h10M4 17h6"
              />
            </svg>
          </span>
          <span className="sidebar-account-label">{t("userMenu.updates")}</span>
        </a>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          className="sidebar-account-link sidebar-account-danger"
        >
          <span className="sidebar-account-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 8V6.5A2.5 2.5 0 0111.5 4h6A2.5 2.5 0 0120 6.5v11A2.5 2.5 0 0117.5 20h-6A2.5 2.5 0 019 17.5V16"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 12H4m0 0l3-3m-3 3l3 3"
              />
            </svg>
          </span>
          <span className="sidebar-account-label">
            {loading ? t("userMenu.signingOut") : t("userMenu.signOut")}
          </span>
        </button>
      </div>
    </div>
  );
}
