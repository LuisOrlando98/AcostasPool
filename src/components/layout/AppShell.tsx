"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import SidebarAccount from "@/components/layout/SidebarAccount";
import NotificationsBell from "@/components/layout/NotificationsBell";
import InstallAppAction from "@/components/pwa/InstallAppAction";
import ModalPresenceManager from "@/components/ui/ModalPresenceManager";
import { useI18n } from "@/i18n/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { UserRole } from "@/lib/auth/config";
import { getAssetUrl } from "@/lib/assets";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

export type NavItem = {
  label: string;
  href: string;
  icon?: ReactNode;
};

type NavSection = {
  key: string;
  label?: string;
  items: NavItem[];
};

const iconClassName = "h-5 w-5";

const adminNavSections = (t: (key: string) => string): NavSection[] => [
  {
    key: "operations",
    label: t("nav.admin.sections.operations"),
    items: [
      {
        label: t("nav.admin.dashboard"),
        href: "/admin",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 11.5L12 4l8.5 7.5V20a1 1 0 01-1 1h-5.5v-6h-4v6H4.5a1 1 0 01-1-1v-8.5z" />
          </svg>
        ),
      },
      {
        label: t("nav.admin.routes"),
        href: "/admin/routes",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
            <rect x="3.5" y="4.5" width="17" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5V7.5M17 3.5V7.5M3.5 9.5H20.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h3M13 13h3M8 17h3M13 17h3" />
          </svg>
        ),
      },
      {
        label: t("nav.admin.technicians"),
        href: "/admin/technicians",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 18a4.5 4.5 0 019 0" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 9.5a3.5 3.5 0 117 0" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h10M9.5 5.5h5l-0.7 3.5h-3.6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 14.5l2.5 2.5 2.5-2.5" />
          </svg>
        ),
      },
      {
        label: t("nav.admin.customers"),
        href: "/admin/customers",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 19c0-2.5 2.8-4.5 6.3-4.5S18 16.5 18 19" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 8.5a3.5 3.5 0 107 0 3.5 3.5 0 00-7 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    key: "finance",
    label: t("nav.admin.sections.finance"),
    items: [
      {
        label: t("nav.admin.invoices"),
        href: "/admin/invoices",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h7l4.5 4.5V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 16.5h5" />
          </svg>
        ),
      },
      {
        label: t("nav.admin.reports"),
        href: "/admin/reports",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 16v-5m5 5V6m5 10v-3" />
          </svg>
        ),
      },
    ],
  },
  {
    key: "config",
    label: t("nav.admin.sections.config"),
    items: [
      {
        label: t("admin.notifications.title"),
        href: "/admin/notifications",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 18.75a2.25 2.25 0 01-4.5 0m9-3.75V11.25a6.75 6.75 0 10-13.5 0V15L3 17.25h18l-2.25-2.25z" />
          </svg>
        ),
      },
      {
        label: t("nav.admin.settings"),
        href: "/admin/settings",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.5 2.5h1l.6 2.4 2.1.8 2-1.3.8.8-1.4 1.9.8 2.1 2.4.6v1l-2.4.6-.8 2.1 1.4 1.9-.8.8-2-1.3-2.1.8-.6 2.4h-1l-.6-2.4-2.1-.8-2 1.3-.8-.8 1.4-1.9-.8-2.1-2.4-.6v-1l2.4-.6.8-2.1-1.4-1.9.8-.8 2 1.3 2.1-.8.6-2.4z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
    ],
  },
];

const techNavSections = (t: (key: string) => string): NavSection[] => [
  {
    key: "tech",
    items: [
      {
        label: t("nav.tech.route"),
        href: "/tech",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 11.5L12 4l8.5 7.5V20a1 1 0 01-1 1h-5.5v-6h-4v6H4.5a1 1 0 01-1-1v-8.5z" />
          </svg>
        ),
      },
      {
        label: t("nav.tech.history"),
        href: "/tech/history",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 1015 0 7.5 7.5 0 00-15 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v4.5l3 2" />
          </svg>
        ),
      },
    ],
  },
];

const clientNavItems = (t: (key: string) => string): NavItem[] => [
  {
    label: t("nav.client.home"),
    href: "/client",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 11.5L12 4l8.5 7.5V20a1 1 0 01-1 1h-5.5v-6h-4v6H4.5a1 1 0 01-1-1v-8.5z" />
      </svg>
    ),
  },
  {
    label: t("nav.client.request"),
    href: "/client/request",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5h15v11h-15z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5h9M7.5 14h5" />
      </svg>
    ),
  },
  {
    label: t("nav.client.invoices"),
    href: "/client/invoices",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h7l4.5 4.5V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 16.5h5" />
      </svg>
    ),
  },
  {
    label: t("nav.client.properties"),
    href: "/client/properties",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 4l7.5 6.5V19a1 1 0 01-1 1H5.5a1 1 0 01-1-1v-8.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20v-5.5h6V20" />
      </svg>
    ),
  },
];

const clientNavSections = (t: (key: string) => string): NavSection[] => [
  { key: "client", items: clientNavItems(t) },
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

function NavLink({
  item,
  pathname,
  mobile = false,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const isRoot =
    item.href === "/admin" || item.href === "/client" || item.href === "/tech";
  const isActive = isRoot
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      title={item.label}
      onClick={onNavigate}
      className={`nav-item sidebar-item group relative flex items-center gap-3 ${mobile ? "px-3 py-2.5" : "px-4 py-2.5"}`}
      data-active={isActive}
    >
      <span
        className={`nav-icon sidebar-icon flex shrink-0 items-center justify-center transition ${mobile ? "h-9 w-9" : "h-10 w-10"}`}
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
}

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
  const { user: currentUser } = useCurrentUser();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("ap:sidebar-collapsed") === "true";
  });
  const drawerSwipeStartXRef = useRef<number | null>(null);

  const sections: NavSection[] = navItems
    ? [{ key: "custom", items: navItems }]
    : role === "ADMIN"
      ? adminNavSections(t)
      : role === "TECH"
        ? techNavSections(t)
        : clientNavSections(t);

  const allItems = sections.flatMap((s) => s.items);

  const resolvedRoleLabel =
    roleLabel ??
    (role === "ADMIN"
      ? t("roles.admin")
      : role === "TECH"
        ? t("roles.tech")
        : role === "CUSTOMER"
          ? t("roles.client")
          : t("app.platform"));

  const accountHref = role === "CUSTOMER" ? "/client/profile" : "/account";
  const contentMaxWidth = wide ? "max-w-[120rem]" : "max-w-[96rem]";
  const peerMaxWidth = wide
    ? "lg:peer-checked:[&_.app-content]:max-w-[120rem]"
    : "lg:peer-checked:[&_.app-content]:max-w-[112rem]";
  const canAccessHelpCenter = role === "ADMIN";
  const canAccessServiceAgreement = role === "ADMIN";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ap:sidebar-collapsed", collapsed ? "true" : "false");
  }, [collapsed]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen || typeof window === "undefined") return;
    const unlock = lockBodyScroll();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    drawerSwipeStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    if (drawerSwipeStartXRef.current === null) return;
    const dx = (e.touches[0]?.clientX ?? 0) - drawerSwipeStartXRef.current;
    if (dx < -48) {
      setMobileNavOpen(false);
      drawerSwipeStartXRef.current = null;
    }
  };

  const handleDrawerTouchEnd = () => {
    drawerSwipeStartXRef.current = null;
  };

  const userInitials = currentUser?.name
    ? currentUser.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()
    : "AP";

  return (
    <div
      data-app-shell-role={role ?? "UNKNOWN"}
      className="relative min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--ink)]"
    >
      <ModalPresenceManager />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,_rgba(14,165,233,0.05),_transparent_42%)]" />
      <input
        id="sidebar-toggle"
        type="checkbox"
        className="peer hidden"
        checked={collapsed}
        onChange={(event) => setCollapsed(event.target.checked)}
      />
      <div
        className={`relative min-h-screen lg:grid lg:min-h-screen lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:transition-[grid-template-columns] lg:duration-300 lg:ease-in-out lg:peer-checked:[grid-template-columns:5rem_minmax(0,1fr)] lg:peer-checked:[&_.sidebar-shell-desktop]:w-20 lg:peer-checked:[&_.brand-text]:max-w-0 lg:peer-checked:[&_.brand-text]:opacity-0 lg:peer-checked:[&_.brand-text]:-translate-x-2 lg:peer-checked:[&_.brand-text]:pointer-events-none lg:peer-checked:[&_.nav-label]:max-w-0 lg:peer-checked:[&_.nav-label]:opacity-0 lg:peer-checked:[&_.nav-label]:-translate-x-2 lg:peer-checked:[&_.nav-label]:pointer-events-none lg:peer-checked:[&_.nav-section-label]:max-w-0 lg:peer-checked:[&_.nav-section-label]:opacity-0 lg:peer-checked:[&_.nav-section-label]:pointer-events-none lg:peer-checked:[&_.nav-item]:justify-center lg:peer-checked:[&_.nav-item]:gap-0 lg:peer-checked:[&_.nav-item]:px-2 lg:peer-checked:[&_.nav-icon]:h-10 lg:peer-checked:[&_.nav-icon]:w-10 lg:peer-checked:[&_.brand-wrap]:justify-center lg:peer-checked:[&_.brand-wrap]:px-3 lg:peer-checked:[&_.brand-wrap]:gap-0 lg:peer-checked:[&_.nav-list]:px-2 lg:peer-checked:[&_.sidebar-toggle-icon]:rotate-180 ${peerMaxWidth}`}
      >
        {/* ── Desktop sidebar ── */}
        <aside className="sidebar-shell sidebar-shell-desktop group relative hidden w-full flex-col overflow-visible border-r border-[var(--sidebar-border)] text-[var(--sidebar-ink)] lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:h-[100dvh] lg:w-[18rem] lg:min-h-0 lg:transition-[width] lg:duration-300 lg:ease-in-out">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-28 -top-36 h-80 w-80 rounded-full bg-cyan-300/12 blur-3xl" />
            <div className="absolute left-[-6rem] top-24 h-72 w-72 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute -bottom-40 right-[-6rem] h-96 w-96 rounded-full bg-blue-700/25 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_transparent)]" />
          </div>
          <div className="sidebar-brand brand-wrap relative z-10 flex h-20 items-center gap-3 px-5">
            <div className="sidebar-logo flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden ring-1 ring-white/20">
              <img src="/newlogo.png" alt={`${t("app.name")} logo`} className="h-full w-full object-cover" />
            </div>
            <div className="brand-text max-w-[12rem] overflow-hidden transition-all duration-300">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--sidebar-ink)]">
                {t("app.name")}
              </p>
              <p className="text-xs text-[var(--sidebar-muted)]">{t("app.tagline")}</p>
            </div>
          </div>
          <label
            htmlFor="sidebar-toggle"
            className="absolute -right-3.5 top-1/2 z-[80] hidden h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 opacity-0 transition pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:border-slate-300 hover:text-slate-900 lg:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sidebar-toggle-icon h-3 w-3 transition">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
            <span className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
          </label>

          <nav className="nav-list relative z-10 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-4 py-4 text-sm">
            {sections.map((section, sectionIndex) => (
              <div
                key={section.key}
                className={sectionIndex > 0 ? "mt-2 border-t border-[var(--sidebar-border)] pt-2" : ""}
              >
                {section.label ? (
                  <p className="nav-section-label max-w-[12rem] overflow-hidden whitespace-nowrap px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-muted)] transition-all duration-300">
                    {section.label}
                  </p>
                ) : null}
                {section.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-account relative z-10 px-5 pb-5 pt-4">
            <SidebarAccount />
          </div>
          <div className="sidebar-footer relative z-10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-muted)]">
            <div className="sidebar-footer-meta flex items-start justify-between gap-2">
              <span className="sidebar-footer-version">AcostasPool v1.0</span>
              {canAccessHelpCenter ? (
                <div className="flex flex-col items-end gap-1">
                  <Link
                    href="/admin/help"
                    className="sidebar-footer-link inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-100 transition hover:text-white"
                  >
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] leading-none">?</span>
                    <span className="sidebar-footer-link-label">{t("nav.admin.helpCenter")}</span>
                  </Link>
                  {canAccessServiceAgreement ? (
                    <Link
                      href="/admin/agreement-service"
                      className="sidebar-footer-link inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-100 transition hover:text-white"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h8l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 3.5v4h4M9 12h6M9 16h6" />
                      </svg>
                      <span className="sidebar-footer-link-label">{t("nav.admin.serviceAgreement")}</span>
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        {/* ── Header ── */}
        <header className="app-shell-header sticky top-0 z-[950] border-b border-[var(--border)] bg-white/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 lg:col-start-2 lg:row-start-1">
          <div className={`app-content mx-auto flex h-20 w-full ${contentMaxWidth} items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6`}>
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 lg:hidden"
                aria-label={t("common.navigation.menu")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                  {resolvedRoleLabel}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                  <h1 className="truncate text-xl font-semibold">{title}</h1>
                </div>
                {subtitle ? (
                  <p className="truncate text-sm text-slate-500">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationsBell />
            </div>
          </div>
        </header>

        {/* ── Mobile drawer ── */}
        {mobileNavOpen ? (
          <div className="fixed inset-0 z-[1000] lg:hidden">
            <button
              type="button"
              aria-label={t("common.actions.close")}
              className="absolute inset-0 bg-slate-900/55"
              onClick={() => setMobileNavOpen(false)}
            />
            <div
              className="sidebar-shell absolute left-0 top-0 flex h-[100dvh] w-[min(86vw,22rem)] flex-col overflow-y-auto border-r border-[var(--sidebar-border)] text-[var(--sidebar-ink)]"
              onTouchStart={handleDrawerTouchStart}
              onTouchMove={handleDrawerTouchMove}
              onTouchEnd={handleDrawerTouchEnd}
            >
              <div className="sidebar-brand relative z-10 px-4 pb-5 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10 text-sm font-semibold">
                      {currentUser?.avatarUrl ? (
                        <img src={getAssetUrl(currentUser.avatarUrl)} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        userInitials
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--sidebar-ink)]">
                        {currentUser?.name ?? t("app.name")}
                      </p>
                      <p className="truncate text-xs text-[var(--sidebar-muted)]">
                        {currentUser?.email ?? resolvedRoleLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] text-[var(--sidebar-ink)] transition hover:bg-white/[0.15]"
                    aria-label={t("common.actions.close")}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>

              <nav className="nav-list relative z-10 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-3 text-sm">
                {sections.map((section, sectionIndex) => (
                  <div
                    key={section.key}
                    className={sectionIndex > 0 ? "mt-2 border-t border-[var(--sidebar-border)] pt-2" : ""}
                  >
                    {section.label ? (
                      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">
                        {section.label}
                      </p>
                    ) : null}
                    {section.items.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        mobile
                        onNavigate={() => setMobileNavOpen(false)}
                      />
                    ))}
                  </div>
                ))}
              </nav>

              <div className="mobile-sidebar-actions relative z-10 border-t border-[var(--sidebar-border)] px-3 py-3">
                <Link
                  href={accountHref}
                  onClick={() => setMobileNavOpen(false)}
                  className="sidebar-account-link w-full justify-start"
                >
                  <span className="sidebar-account-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 18c0-2.6 2.6-4.5 5.5-4.5S17.5 15.4 17.5 18" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 9.5a3.5 3.5 0 117 0 3.5 3.5 0 00-7 0z" />
                    </svg>
                  </span>
                  <span className="sidebar-account-label">{t("userMenu.account")}</span>
                </Link>
                {role === "ADMIN" ? (
                  <Link
                    href="/account/updates"
                    onClick={() => setMobileNavOpen(false)}
                    className="sidebar-account-link mt-1 w-full justify-start"
                  >
                    <span className="sidebar-account-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h10M4 17h6" />
                      </svg>
                    </span>
                    <span className="sidebar-account-label">{t("userMenu.updates")}</span>
                  </Link>
                ) : null}
                <div className="mt-1 [&>button]:w-full [&>button]:justify-start">
                  <InstallAppAction variant="sidebar" />
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="sidebar-account-link sidebar-account-danger mt-1 w-full justify-start"
                >
                  <span className="sidebar-account-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8V6.5A2.5 2.5 0 0111.5 4h6A2.5 2.5 0 0120 6.5v11A2.5 2.5 0 0117.5 20h-6A2.5 2.5 0 019 17.5V16" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 12H4m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </span>
                  <span className="sidebar-account-label">
                    {loggingOut ? t("userMenu.signingOut") : t("userMenu.signOut")}
                  </span>
                </button>
              </div>

              <div className="relative z-10 mt-auto border-t border-[var(--sidebar-border)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-muted)]">
                <div className="flex items-start justify-between gap-2">
                  <span>AcostasPool v1.0</span>
                  {canAccessHelpCenter ? (
                    <div className="flex flex-col items-end gap-1">
                      <Link
                        href="/admin/help"
                        onClick={() => setMobileNavOpen(false)}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-100 transition hover:text-white"
                      >
                        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] leading-none">?</span>
                        <span>{t("nav.admin.helpCenter")}</span>
                      </Link>
                      {canAccessServiceAgreement ? (
                        <Link
                          href="/admin/agreement-service"
                          onClick={() => setMobileNavOpen(false)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-100 transition hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h8l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 3.5v4h4M9 12h6M9 16h6" />
                          </svg>
                          <span>{t("nav.admin.serviceAgreement")}</span>
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Main content ── */}
        <main
          className={`app-content mx-auto flex w-full ${contentMaxWidth} flex-col gap-5 px-4 py-6 animate-fade sm:gap-7 sm:px-6 sm:py-8 lg:col-start-2 lg:row-start-2 lg:gap-8 lg:py-10 ${role === "CUSTOMER" ? "pb-24 lg:pb-10" : ""}`}
        >
          {children}
        </main>

        {/* ── Client bottom navigation bar (mobile only) ── */}
        {role === "CUSTOMER" ? (
          <nav className="fixed inset-x-0 bottom-0 z-[900] flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/85 lg:hidden">
            {clientNavItems(t).map((item) => {
              const isRoot = item.href === "/client";
              const isActive = isRoot
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                    isActive ? "text-sky-600" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center transition ${isActive ? "text-sky-600" : "text-slate-400"}`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
