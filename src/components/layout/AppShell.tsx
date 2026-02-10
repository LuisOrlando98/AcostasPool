"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import UserMenu from "@/components/layout/UserMenu";
import SidebarAccount from "@/components/layout/SidebarAccount";
import NotificationsBell from "@/components/layout/NotificationsBell";
import { useI18n } from "@/i18n/client";
import type { UserRole } from "@/lib/auth/config";

export type NavItem = {
  label: string;
  href: string;
  icon?: ReactNode;
};

const iconClassName = "h-5 w-5";

const adminNavItems = (t: (key: string) => string): NavItem[] => [
  {
    label: t("nav.admin.dashboard"),
    href: "/admin",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.5 11.5L12 4l8.5 7.5V20a1 1 0 01-1 1h-5.5v-6h-4v6H4.5a1 1 0 01-1-1v-8.5z"
        />
      </svg>
    ),
  },
  {
    label: t("nav.admin.routes"),
    href: "/admin/routes",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <rect
          x="3.5"
          y="4.5"
          width="17"
          height="16"
          rx="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 3.5V7.5M17 3.5V7.5M3.5 9.5H20.5"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 13h3M13 13h3M8 17h3M13 17h3"
        />
      </svg>
    ),
  },
  {
    label: t("nav.admin.technicians"),
    href: "/admin/technicians",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 18a4.5 4.5 0 019 0"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.5 9.5a3.5 3.5 0 117 0"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 10h10M9.5 5.5h5l-0.7 3.5h-3.6z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.5 14.5l2.5 2.5 2.5-2.5"
        />
      </svg>
    ),
  },
  {
    label: t("nav.admin.customers"),
    href: "/admin/customers",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 19c0-2.5 2.8-4.5 6.3-4.5S18 16.5 18 19"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.5 8.5a3.5 3.5 0 107 0 3.5 3.5 0 00-7 0z"
        />
      </svg>
    ),
  },
  {
    label: t("nav.admin.invoices"),
    href: "/admin/invoices",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 3.5h7l4.5 4.5V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 13h6M9 16.5h5"
        />
      </svg>
    ),
  },
  {
    label: t("nav.admin.reports"),
    href: "/admin/reports",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 19h16M7 16v-5m5 5V6m5 10v-3"
        />
      </svg>
    ),
  },
  {
    label: t("nav.admin.settings"),
    href: "/admin/settings",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.5 2.5h1l.6 2.4 2.1.8 2-1.3.8.8-1.4 1.9.8 2.1 2.4.6v1l-2.4.6-.8 2.1 1.4 1.9-.8.8-2-1.3-2.1.8-.6 2.4h-1l-.6-2.4-2.1-.8-2 1.3-.8-.8 1.4-1.9-.8-2.1-2.4-.6v-1l2.4-.6.8-2.1-1.4-1.9.8-.8 2 1.3 2.1-.8.6-2.4z"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

const techNavItems = (t: (key: string) => string): NavItem[] => [
  {
    label: t("nav.tech.route"),
    href: "/tech",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.5 11.5L12 4l8.5 7.5V20a1 1 0 01-1 1h-5.5v-6h-4v6H4.5a1 1 0 01-1-1v-8.5z"
        />
      </svg>
    ),
  },
  {
    label: t("nav.tech.history"),
    href: "/tech/history",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 12a7.5 7.5 0 1015 0 7.5 7.5 0 00-15 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 7.5v4.5l3 2"
        />
      </svg>
    ),
  },
  {
    label: t("nav.tech.profile"),
    href: "/tech/profile",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 18a4.5 4.5 0 019 0"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.5 9.5a3.5 3.5 0 117 0"
        />
      </svg>
    ),
  },
];

const clientNavItems = (t: (key: string) => string): NavItem[] => [
  {
    label: t("nav.client.home"),
    href: "/client",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.5 11.5L12 4l8.5 7.5V20a1 1 0 01-1 1h-5.5v-6h-4v6H4.5a1 1 0 01-1-1v-8.5z"
        />
      </svg>
    ),
  },
  {
    label: t("nav.client.request"),
    href: "/client/request",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 6.5h15v11h-15z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 10.5h9M7.5 14h5"
        />
      </svg>
    ),
  },
  {
    label: t("nav.client.invoices"),
    href: "/client/invoices",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 3.5h7l4.5 4.5V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 13h6M9 16.5h5"
        />
      </svg>
    ),
  },
  {
    label: t("nav.client.profile"),
    href: "/client/profile",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className={iconClassName}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 18a4.5 4.5 0 019 0"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.5 9.5a3.5 3.5 0 117 0"
        />
      </svg>
    ),
  },
];

type AppShellProps = {
  title: string;
  subtitle?: string;
  role?: UserRole;
  roleLabel?: string;
  navItems?: NavItem[];
  wide?: boolean;
  children: ReactNode;
};

export default function AppShell({
  title,
  subtitle,
  role,
  roleLabel,
  navItems,
  wide = false,
  children,
}: AppShellProps) {
  const { t } = useI18n();
  const items =
    navItems ??
    (role === "TECH"
      ? techNavItems(t)
      : role === "CUSTOMER"
        ? clientNavItems(t)
        : adminNavItems(t));
  const resolvedRoleLabel =
    roleLabel ??
    (role === "ADMIN"
      ? t("roles.admin")
      : role === "TECH"
        ? t("roles.tech")
        : role === "CUSTOMER"
          ? t("roles.client")
          : t("app.platform"));
  const contentMaxWidth = wide ? "max-w-[120rem]" : "max-w-[96rem]";
  const peerMaxWidth = wide
    ? "lg:peer-checked:[&_.app-content]:max-w-[120rem]"
    : "lg:peer-checked:[&_.app-content]:max-w-[112rem]";
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("ap:sidebar-collapsed") === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      "ap:sidebar-collapsed",
      collapsed ? "true" : "false"
    );
  }, [collapsed]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,_rgba(14,165,233,0.08),_transparent_40%),radial-gradient(circle_at_88%_14%,_rgba(34,197,94,0.08),_transparent_45%),radial-gradient(circle_at_84%_86%,_rgba(249,115,22,0.08),_transparent_45%)]" />
      <input
        id="sidebar-toggle"
        type="checkbox"
        className="peer hidden"
        checked={collapsed}
        onChange={(event) => setCollapsed(event.target.checked)}
      />
      <div
        className={`relative min-h-screen lg:grid lg:h-screen lg:overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:transition-[grid-template-columns] lg:duration-300 lg:ease-in-out lg:peer-checked:[grid-template-columns:5rem_minmax(0,1fr)] lg:peer-checked:[&_.brand-text]:max-w-0 lg:peer-checked:[&_.brand-text]:opacity-0 lg:peer-checked:[&_.brand-text]:-translate-x-2 lg:peer-checked:[&_.brand-text]:pointer-events-none lg:peer-checked:[&_.nav-label]:max-w-0 lg:peer-checked:[&_.nav-label]:opacity-0 lg:peer-checked:[&_.nav-label]:-translate-x-2 lg:peer-checked:[&_.nav-label]:pointer-events-none lg:peer-checked:[&_.nav-item]:justify-center lg:peer-checked:[&_.nav-item]:gap-0 lg:peer-checked:[&_.nav-item]:px-2 lg:peer-checked:[&_.nav-icon]:h-10 lg:peer-checked:[&_.nav-icon]:w-10 lg:peer-checked:[&_.brand-wrap]:justify-center lg:peer-checked:[&_.brand-wrap]:px-3 lg:peer-checked:[&_.brand-wrap]:gap-0 lg:peer-checked:[&_.nav-list]:px-2 lg:peer-checked:[&_.sidebar-toggle-icon]:rotate-180 ${peerMaxWidth}`}
      >
        <aside className="sidebar-shell group relative hidden w-full flex-col overflow-visible border-r border-[var(--sidebar-border)] text-[var(--sidebar-ink)] shadow-[0_24px_60px_rgba(4,11,21,0.6)] lg:flex lg:row-span-2 lg:h-screen lg:sticky lg:top-0 lg:self-start">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-28 -top-36 h-80 w-80 rounded-full bg-cyan-300/12 blur-3xl" />
            <div className="absolute left-[-6rem] top-24 h-72 w-72 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute -bottom-40 right-[-6rem] h-96 w-96 rounded-full bg-blue-700/25 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_transparent)]" />
          </div>
          <div className="sidebar-brand brand-wrap relative z-10 flex h-20 items-center gap-3 px-5">
            <div className="sidebar-logo flex h-12 w-12 shrink-0 items-center justify-center ring-1 ring-white/20" />
            <div className="brand-text max-w-[12rem] overflow-hidden transition-all duration-300">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--sidebar-ink)]">
                {t("app.name")}
              </p>
              <p className="text-xs text-[var(--sidebar-muted)]">
                {t("app.tagline")}
              </p>
            </div>
          </div>
          <label
            htmlFor="sidebar-toggle"
            className="absolute -right-3.5 top-1/2 z-[80] hidden h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 opacity-0 transition shadow-[0_12px_26px_rgba(12,18,28,0.24)] pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:border-slate-300 hover:text-slate-900 lg:flex"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="sidebar-toggle-icon h-3 w-3 transition"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 18l-6-6 6-6"
              />
            </svg>
            <span className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
          </label>
          <nav className="nav-list relative z-10 flex-1 space-y-1 overflow-y-auto px-4 py-5 text-sm">
            {items.map((item) => {
              const isRoot =
                item.href === "/admin" ||
                item.href === "/client" ||
                item.href === "/tech";
              const isActive = isRoot
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className="nav-item sidebar-item group relative flex items-center gap-3 px-4 py-2.5"
                  data-active={isActive}
                >
                  <span
                    className="nav-icon sidebar-icon flex h-10 w-10 shrink-0 items-center justify-center transition"
                  >
                    {item.icon ?? (
                      <span className="text-[11px] font-semibold">
                        {item.label.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="nav-label max-w-[12rem] overflow-hidden whitespace-nowrap transition-all duration-300">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-account relative z-10 px-5 pt-4">
            <SidebarAccount />
          </div>
        </aside>

        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/80 backdrop-blur-xl lg:col-start-2 lg:row-start-1">
          <div
            className={`app-content mx-auto flex h-20 w-full ${contentMaxWidth} items-center justify-between gap-4 px-6`}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                {resolvedRoleLabel}
              </p>
              <div className="mt-1 flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                <h1 className="text-xl font-semibold">{title}</h1>
              </div>
              {subtitle ? (
                <p className="text-sm text-slate-500">{subtitle}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-sky-100 bg-sky-50/80 px-3 py-1 text-xs text-slate-600 sm:inline">
                {t("common.environment.local")}
              </span>
              <div className="hidden lg:block">
                <NotificationsBell />
              </div>
              <div className="lg:hidden">
                <UserMenu />
              </div>
              <details className="relative lg:hidden">
                <summary className="cursor-pointer rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">
                  {t("common.navigation.menu")}
                </summary>
                <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="px-4 py-3 text-xs text-slate-500">
                    {t("common.navigation.quick")}
                  </div>
                  <div className="space-y-1 px-2 pb-3 text-sm">
                    {items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </div>
        </header>

        <main
          className={`app-content mx-auto flex w-full ${contentMaxWidth} flex-col gap-8 px-6 py-10 animate-fade lg:col-start-2 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
