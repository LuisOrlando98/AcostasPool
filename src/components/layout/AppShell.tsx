"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import SidebarAccount from "@/components/layout/SidebarAccount";
import NotificationsBell from "@/components/layout/NotificationsBell";
import DeveloperViewBanner from "@/components/layout/DeveloperViewBanner";
import { DeveloperViewSwitcherPanel } from "@/components/layout/DeveloperViewSwitcher";
import InstallAppAction from "@/components/pwa/InstallAppAction";
import { applyInertOutside } from "@/components/ui/AppModal";
import ModalPresenceManager from "@/components/ui/ModalPresenceManager";
import { useI18n } from "@/i18n/client";
import type { UserRole } from "@/lib/auth/config";
import { getAssetUrl } from "@/lib/assets";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";
import { useEscapeKey } from "@/lib/ui/use-escape-key";
import { useFocusTrap } from "@/lib/ui/use-focus-trap";

export type NavItem = {
  label: string;
  href: string;
  icon?: ReactNode;
};

type MobileUser = {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
};

const MOBILE_USER_CACHE_KEY = "ap:me-cache:v1";
const MOBILE_USER_CACHE_TTL_MS = 5 * 60 * 1000;
const SIDEBAR_COLLAPSED_STORAGE_KEY = "ap:sidebar-collapsed";
/**
 * El checkbox oculto sigue existiendo solo porque `globals.css` y las
 * variantes `peer-checked:` dependen de `#sidebar-toggle:checked`; el control
 * real (teclado y ratón) es el botón `aria-expanded` del aside.
 */
const SIDEBAR_TOGGLE_ID = "sidebar-toggle";
const DESKTOP_SIDEBAR_ID = "app-sidebar";
/** Destino del enlace "saltar al contenido" que renderiza `app/layout.tsx`. */
const MAIN_CONTENT_ID = "main-content";
/** Breakpoint `lg` de Tailwind: a partir de él el drawer móvil deja de existir. */
const DESKTOP_MEDIA_QUERY = "(min-width: 64rem)";
const DOCUMENT_TITLE_SUFFIX = "AcostasPool";
const ROOT_NAV_HREFS: ReadonlySet<string> = new Set(["/admin", "/client", "/tech"]);

function isNavItemActive(href: string, pathname: string): boolean {
  return ROOT_NAV_HREFS.has(href) ? pathname === href : pathname.startsWith(href);
}

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
    label: t("admin.notifications.title"),
    href: "/admin/notifications",
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
          d="M14.25 18.75a2.25 2.25 0 01-4.5 0m9-3.75V11.25a6.75 6.75 0 10-13.5 0V15L3 17.25h18l-2.25-2.25z"
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
    label: t("nav.client.properties"),
    href: "/client/properties",
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
          d="M4.5 10.5L12 4l7.5 6.5V19a1 1 0 01-1 1H5.5a1 1 0 01-1-1v-8.5z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 20v-5.5h6V20"
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
  const accountHref = role === "CUSTOMER" ? "/client/profile" : "/account";
  const contentMaxWidth = wide ? "max-w-[120rem]" : "max-w-[96rem]";
  const peerMaxWidth = wide
    ? "lg:peer-checked:[&_.app-content]:max-w-[120rem]"
    : "lg:peer-checked:[&_.app-content]:max-w-[112rem]";
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileNavPathname, setMobileNavPathname] = useState(pathname);
  const [mobileUser, setMobileUser] = useState<MobileUser | null>(null);
  const canAccessHelpCenter = role === "ADMIN";
  const canAccessServiceAgreement = role === "ADMIN";
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  });
  const mobileNavId = useId();
  const mobileNavTitleId = useId();
  const mobileNavLayerRef = useRef<HTMLDivElement>(null);
  const mobileNavPanelRef = useRef<HTMLDivElement>(null);
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarToggleLabel = collapsed
    ? t("layout.sidebar.expand")
    : t("layout.sidebar.collapse");
  const primaryNavLabel = t("layout.navigation.primary");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      collapsed ? "true" : "false"
    );
  }, [collapsed]);

  // Título de la pestaña sincronizado con el título de la página; la metadata
  // de servidor (layout.tsx) no cambia.
  useEffect(() => {
    if (!title) {
      return;
    }
    document.title = `${title} · ${DOCUMENT_TITLE_SUFFIX}`;
  }, [title]);

  if (mobileNavPathname !== pathname) {
    setMobileNavPathname(pathname);
    setMobileNavOpen(false);
  }

  // Si el viewport cruza a escritorio con el drawer abierto (giro de tablet),
  // se cierra: en `lg` el drawer es `hidden` y dejaría el foco atrapado y la
  // página inerte sin ningún control visible para salir.
  useEffect(() => {
    if (!mobileNavOpen || typeof window === "undefined") {
      return;
    }
    const desktopQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileNavOpen(false);
      }
    };
    desktopQuery.addEventListener("change", closeOnDesktop);
    return () => {
      desktopQuery.removeEventListener("change", closeOnDesktop);
    };
  }, [mobileNavOpen]);

  // Declarado antes de la trampa de foco a propósito (mismo orden que AppModal):
  // el foco solo puede volver a la hamburguesa cuando el header ya no es `inert`.
  useEffect(() => {
    if (!mobileNavOpen || typeof window === "undefined") {
      return;
    }
    const unlock = lockBodyScroll();
    const layer = mobileNavLayerRef.current;
    const releaseInert = layer ? applyInertOutside<Element>(layer) : () => undefined;

    return () => {
      releaseInert();
      unlock();
    };
  }, [mobileNavOpen]);

  useEscapeKey(() => setMobileNavOpen(false), mobileNavOpen);

  useFocusTrap(mobileNavPanelRef, {
    active: mobileNavOpen,
    returnFocusTo: mobileNavTriggerRef,
  });

  useEffect(() => {
    let cancelled = false;

    const readCachedUser = (): MobileUser | null => {
      if (typeof window === "undefined") {
        return null;
      }
      try {
        const cached = window.sessionStorage.getItem(MOBILE_USER_CACHE_KEY);
        if (!cached) {
          return null;
        }
        const parsed = JSON.parse(cached) as {
          ts?: number;
          user?: MobileUser | null;
        };
        const isFresh =
          Boolean(parsed?.ts) && Date.now() - (parsed.ts ?? 0) < MOBILE_USER_CACHE_TTL_MS;
        return isFresh && parsed.user ? parsed.user : null;
      } catch {
        // Ignore cache parsing failures.
        return null;
      }
    };

    const writeCachedUser = (user: MobileUser) => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        window.sessionStorage.setItem(
          MOBILE_USER_CACHE_KEY,
          JSON.stringify({ ts: Date.now(), user })
        );
      } catch {
        // Ignore cache write failures.
      }
    };

    const loadUser = async () => {
      const cachedUser = readCachedUser();
      if (cachedUser) {
        setMobileUser(cachedUser);
      }

      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await response.json().catch(() => ({ user: null }));
        if (cancelled || !data?.user) {
          return;
        }
        const nextUser: MobileUser = {
          name: data.user.name,
          email: data.user.email,
          avatarUrl: data.user.avatarUrl ?? null,
        };
        setMobileUser(nextUser);
        writeCachedUser(nextUser);
      } catch {
        // Sin red o respuesta inválida: el drawer conserva la caché o el
        // fallback (iniciales "AP" y nombre de la app). Solo se evita el
        // rechazo no manejado.
      }
    };

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`);
      }
      window.location.href = "/login";
    } catch {
      // Only the failure path re-enables the button: on success we navigate away.
      setLogoutError(t("layout.logout.error"));
      setLoggingOut(false);
    }
  };

  return (
    <div
      data-app-shell-role={role ?? "UNKNOWN"}
      className="relative min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--ink)]"
    >
      <ModalPresenceManager />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,_rgba(14,165,233,0.05),_transparent_42%)]" />
      <input
        id={SIDEBAR_TOGGLE_ID}
        type="checkbox"
        className="peer hidden"
        checked={collapsed}
        readOnly
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        className={`relative min-h-screen lg:grid lg:min-h-screen lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:transition-[grid-template-columns] lg:duration-300 lg:ease-in-out lg:peer-checked:[grid-template-columns:5rem_minmax(0,1fr)] lg:peer-checked:[&_.sidebar-shell-desktop]:w-20 lg:peer-checked:[&_.brand-text]:max-w-0 lg:peer-checked:[&_.brand-text]:opacity-0 lg:peer-checked:[&_.brand-text]:-translate-x-2 lg:peer-checked:[&_.brand-text]:pointer-events-none lg:peer-checked:[&_.nav-label]:max-w-0 lg:peer-checked:[&_.nav-label]:opacity-0 lg:peer-checked:[&_.nav-label]:-translate-x-2 lg:peer-checked:[&_.nav-label]:pointer-events-none lg:peer-checked:[&_.nav-item]:justify-center lg:peer-checked:[&_.nav-item]:gap-0 lg:peer-checked:[&_.nav-item]:px-2 lg:peer-checked:[&_.nav-icon]:h-10 lg:peer-checked:[&_.nav-icon]:w-10 lg:peer-checked:[&_.brand-wrap]:justify-center lg:peer-checked:[&_.brand-wrap]:px-3 lg:peer-checked:[&_.brand-wrap]:gap-0 lg:peer-checked:[&_.nav-list]:px-2 lg:peer-checked:[&_.sidebar-toggle-icon]:rotate-180 ${peerMaxWidth}`}
      >
        <aside
          id={DESKTOP_SIDEBAR_ID}
          className="sidebar-shell sidebar-shell-desktop group relative hidden w-full flex-col overflow-visible border-r border-[var(--sidebar-border)] text-[var(--sidebar-ink)] lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:h-[100dvh] lg:w-[18rem] lg:min-h-0 lg:transition-[width] lg:duration-300 lg:ease-in-out"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-28 -top-36 h-80 w-80 rounded-full bg-cyan-300/12 blur-3xl" />
            <div className="absolute left-[-6rem] top-24 h-72 w-72 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute -bottom-40 right-[-6rem] h-96 w-96 rounded-full bg-blue-700/25 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_transparent)]" />
          </div>
          <div className="sidebar-brand brand-wrap relative z-10 flex h-20 items-center gap-3 px-5">
            <div className="sidebar-logo flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden ring-1 ring-white/20">
              <img
                src="/newlogo.png"
                alt={`${t("app.name")} logo`}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="brand-text max-w-[12rem] overflow-hidden transition-all duration-300">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--sidebar-ink)]">
                {t("app.name")}
              </p>
              <p className="text-xs text-[var(--sidebar-muted)]">
                {t("app.tagline")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-controls={DESKTOP_SIDEBAR_ID}
            aria-label={sidebarToggleLabel}
            title={sidebarToggleLabel}
            className="absolute -right-3.5 top-1/2 z-[80] hidden h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 opacity-0 transition pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto hover:border-slate-300 hover:text-slate-900 lg:flex"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="sidebar-toggle-icon h-3 w-3 transition"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 18l-6-6 6-6"
              />
            </svg>
            <span className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
          </button>
          <nav
            aria-label={primaryNavLabel}
            className="nav-list relative z-10 min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-5 text-sm"
          >
            {items.map((item) => {
              const isActive = isNavItemActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className="nav-item sidebar-item group relative flex items-center gap-3 px-4 py-2.5"
                  data-active={isActive}
                  aria-current={isActive ? "page" : undefined}
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
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] leading-none">
                      ?
                    </span>
                    <span className="sidebar-footer-link-label">
                      {t("nav.admin.helpCenter")}
                    </span>
                  </Link>
                  {canAccessServiceAgreement ? (
                    <Link
                      href="/admin/agreement-service"
                      className="sidebar-footer-link inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-100 transition hover:text-white"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-3.5 w-3.5 shrink-0"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7 3.5h8l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 3.5v4h4M9 12h6M9 16h6"
                        />
                      </svg>
                      <span className="sidebar-footer-link-label">
                        {t("nav.admin.serviceAgreement")}
                      </span>
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <header className="app-shell-header sticky top-0 z-[950] border-b border-[var(--border)] bg-white/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 lg:col-start-2 lg:row-start-1">
          <div
            className={`app-content mx-auto flex h-20 w-full ${contentMaxWidth} items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6`}
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <button
                ref={mobileNavTriggerRef}
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-expanded={mobileNavOpen}
                aria-controls={mobileNavId}
                aria-haspopup="dialog"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 lg:hidden"
                aria-label={t("common.navigation.menu")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 7h16M4 12h16M4 17h10"
                  />
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

        {mobileNavOpen ? (
          <div ref={mobileNavLayerRef} className="fixed inset-0 z-[1000] lg:hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-slate-900/55"
              onClick={() => setMobileNavOpen(false)}
            />
            <div
              ref={mobileNavPanelRef}
              id={mobileNavId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={mobileNavTitleId}
              tabIndex={-1}
              className="sidebar-shell absolute left-0 top-0 flex h-[100dvh] w-[min(86vw,22rem)] flex-col overflow-y-auto border-r border-[var(--sidebar-border)] text-[var(--sidebar-ink)] outline-none"
            >
              <h2 id={mobileNavTitleId} className="sr-only">
                {t("common.navigation.menu")}
              </h2>
              <div className="sidebar-brand relative z-10 px-4 pb-5 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10 text-sm font-semibold">
                      {mobileUser?.avatarUrl ? (
                        <img
                          src={getAssetUrl(mobileUser.avatarUrl)}
                          alt={t("account.avatar.alt")}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (mobileUser?.name ?? "AP")
                          .split(" ")
                          .map((part: string) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--sidebar-ink)]">
                        {mobileUser?.name ?? t("app.name")}
                      </p>
                      <p className="truncate text-xs text-[var(--sidebar-muted)]">
                        {mobileUser?.email ?? resolvedRoleLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] text-[var(--sidebar-ink)] transition hover:bg-white/[0.15]"
                    aria-label={t("common.actions.close")}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 6l12 12M18 6L6 18"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <nav
                aria-label={primaryNavLabel}
                className="nav-list relative z-10 min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3 text-sm"
              >
                {items.map((item) => {
                  const isActive = isNavItemActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      data-active={isActive}
                      aria-current={isActive ? "page" : undefined}
                      className="nav-item sidebar-item group relative flex items-center gap-3 px-3 py-2.5"
                    >
                      <span className="nav-icon sidebar-icon flex h-9 w-9 shrink-0 items-center justify-center transition">
                        {item.icon ?? (
                          <span className="text-[11px] font-semibold">
                            {item.label.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="truncate font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mobile-sidebar-actions relative z-10 border-t border-[var(--sidebar-border)] px-3 py-3">
                <Link
                  href={accountHref}
                  onClick={() => setMobileNavOpen(false)}
                  className="sidebar-account-link w-full justify-start"
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
                </Link>
                {role === "ADMIN" ? (
                  <Link
                    href="/account/updates"
                    onClick={() => setMobileNavOpen(false)}
                    className="sidebar-account-link mt-1 w-full justify-start"
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
                          d="M4 7h16M4 12h10M4 17h6"
                        />
                      </svg>
                    </span>
                    <span className="sidebar-account-label">{t("userMenu.updates")}</span>
                  </Link>
                ) : null}
                <div className="mt-1 [&>button]:w-full [&>button]:justify-start">
                  <InstallAppAction variant="sidebar" />
                </div>
                <div className="mt-2">
                  <DeveloperViewSwitcherPanel />
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="sidebar-account-link sidebar-account-danger mt-1 w-full justify-start"
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
                    {loggingOut ? t("userMenu.signingOut") : t("userMenu.signOut")}
                  </span>
                </button>
                {logoutError ? (
                  <p role="alert" className="mt-2 px-3 text-xs text-rose-300">
                    {logoutError}
                  </p>
                ) : null}
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
                        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] leading-none">
                          ?
                        </span>
                        <span>{t("nav.admin.helpCenter")}</span>
                      </Link>
                      {canAccessServiceAgreement ? (
                        <Link
                          href="/admin/agreement-service"
                          onClick={() => setMobileNavOpen(false)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-100 transition hover:text-white"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-3.5 w-3.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M7 3.5h8l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 3.5v4h4M9 12h6M9 16h6"
                            />
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

        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className={`app-content mx-auto flex w-full ${contentMaxWidth} flex-col gap-5 px-4 py-6 animate-fade focus:outline-none sm:gap-7 sm:px-6 sm:py-8 lg:col-start-2 lg:row-start-2 lg:gap-8 lg:py-10`}
        >
          <DeveloperViewBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
