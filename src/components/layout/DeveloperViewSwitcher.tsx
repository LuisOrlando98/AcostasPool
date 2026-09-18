"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { ROLE_REDIRECTS, type UserRole } from "@/lib/auth/config";
import { useEscapeKey } from "@/lib/ui/use-escape-key";
import { useFocusTrap } from "@/lib/ui/use-focus-trap";

/**
 * Conmutador de vista de desarrollador.
 *
 * Vive en la cabecera, junto a la campana de notificaciones, y es el ÚNICO
 * punto de cambio de vista: aparece igual en las tres vistas (admin, técnico y
 * cliente). En escritorio es un control segmentado de tres posiciones
 * (`role="radiogroup"`); por debajo de `lg` es un botón de icono que despliega
 * las mismas tres opciones en un menú.
 *
 * No consulta la sesión por su cuenta: `AppShell` le pasa la vista activa a
 * partir de la llamada a `/api/auth/me` que ya hacía.
 */

export const DEV_VIEW_SWITCH_ENDPOINT = "/api/developer/view";
const ROLE_ORDER: readonly UserRole[] = ["ADMIN", "TECH", "CUSTOMER"];
const HTTP_FORBIDDEN = 403;

/** Error de `POST /api/developer/view` con el estado HTTP que lo causó. */
export class DevViewSwitchError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Developer view switch failed with status ${status}`);
    this.name = "DevViewSwitchError";
    this.status = status;
  }
}

type SwitchResponse = {
  redirectTo?: unknown;
};

/** Cambia la vista y devuelve la ruta a la que navegar. */
export async function requestDevViewSwitch(role: UserRole): Promise<string> {
  const response = await fetch(DEV_VIEW_SWITCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    throw new DevViewSwitchError(response.status);
  }
  const body = (await response.json()) as SwitchResponse;
  return typeof body.redirectTo === "string" ? body.redirectTo : ROLE_REDIRECTS[role];
}

const SEGMENT_BASE_CLASS =
  "rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-60";
const SEGMENT_ACTIVE_CLASS = "bg-[var(--brand)] text-white";
const SEGMENT_IDLE_CLASS = "text-slate-600 hover:bg-slate-100";
const MENU_ITEM_BASE_CLASS =
  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition disabled:opacity-60";
const MENU_ITEM_ACTIVE_CLASS = "bg-sky-50 text-sky-700";
const MENU_ITEM_IDLE_CLASS = "text-slate-700 hover:bg-slate-100";

type DeveloperViewSwitcherProps = {
  /** Vista activa ahora mismo: el rol emulado, o ADMIN cuando no hay ninguno. */
  activeRole: UserRole;
};

export default function DeveloperViewSwitcher({
  activeRole,
}: DeveloperViewSwitcherProps) {
  const { t } = useI18n();
  const router = useRouter();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(() => setMenuOpen(false), menuOpen);
  useFocusTrap(menuRef, { active: menuOpen, returnFocusTo: triggerRef });

  const activeRoleLabel = t(`devView.roles.${activeRole}`);
  const roleLabels = useMemo(
    () =>
      ROLE_ORDER.map((role) => ({
        role,
        label: t(`devView.roles.${role}`),
        initial: t(`devView.roleInitials.${role}`),
      })),
    [t]
  );

  const applyRole = async (role: UserRole) => {
    setMenuOpen(false);
    if (switching || role === activeRole) {
      return;
    }
    setError(null);
    setSwitching(true);
    try {
      const redirectTo = await requestDevViewSwitch(role);
      router.push(redirectTo);
      router.refresh();
    } catch (cause) {
      const isForbidden =
        cause instanceof DevViewSwitchError && cause.status === HTTP_FORBIDDEN;
      setError(
        isForbidden ? t("devView.errors.notDeveloper") : t("devView.errors.switch")
      );
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="relative" data-testid="dev-view-switcher">
      <div
        role="radiogroup"
        aria-label={t("devView.groupLabel")}
        data-testid="dev-view-segmented"
        className="hidden items-center gap-0.5 rounded-full border border-[var(--border)] bg-white p-0.5 lg:flex"
      >
        {roleLabels.map(({ role, label }) => {
          const checked = role === activeRole;
          return (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={checked}
              data-role={role}
              disabled={switching}
              onClick={() => applyRole(role)}
              className={`${SEGMENT_BASE_CLASS} ${
                checked ? SEGMENT_ACTIVE_CLASS : SEGMENT_IDLE_CLASS
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        aria-label={t("devView.menuLabel", { role: activeRoleLabel })}
        data-testid="dev-view-menu-trigger"
        disabled={switching}
        onClick={() => setMenuOpen((open) => !open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-slate-600 transition hover:border-[var(--border-strong)] disabled:opacity-60 lg:hidden"
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
            d="M9 7.5L5 12l4 4.5M15 7.5L19 12l-4 4.5"
          />
        </svg>
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--brand)] text-[9px] font-bold leading-none text-white"
        >
          {t(`devView.roleInitials.${activeRole}`)}
        </span>
      </button>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label={t("common.actions.close")}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-[1090] cursor-default lg:hidden"
          />
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={t("devView.menuTitle")}
            tabIndex={-1}
            data-testid="dev-view-menu"
            className="absolute right-0 top-[calc(100%+0.5rem)] z-[1100] w-56 rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-contrast outline-none lg:hidden"
          >
            <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {t("devView.menuTitle")}
            </p>
            {roleLabels.map(({ role, label, initial }) => {
              const checked = role === activeRole;
              return (
                <button
                  key={role}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  data-role={role}
                  disabled={switching}
                  onClick={() => applyRole(role)}
                  className={`${MENU_ITEM_BASE_CLASS} ${
                    checked ? MENU_ITEM_ACTIVE_CLASS : MENU_ITEM_IDLE_CLASS
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-bold"
                  >
                    {initial}
                  </span>
                  <span className="truncate">{label}</span>
                  {checked ? (
                    <span className="ml-auto text-[10px] font-medium uppercase tracking-[0.08em]">
                      {t("devView.activeSuffix")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {error ? (
        <p
          role="alert"
          data-testid="dev-view-error"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[1100] w-64 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 shadow-contrast"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
