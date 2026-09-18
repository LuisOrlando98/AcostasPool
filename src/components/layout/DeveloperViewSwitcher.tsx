"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { ROLE_REDIRECTS, type UserRole } from "@/lib/auth/config";

/**
 * Conmutador de vista de desarrollador.
 *
 * Vive en `SidebarAccount` (escritorio) y en el drawer móvil de `AppShell`, así
 * que se renderiza en las tres vistas (admin, técnico y cliente) y permite
 * volver a administrador sin cerrar sesión.
 *
 * Los textos salen del diccionario normal bajo la clave `devView.*`.
 */

const ME_ENDPOINT = "/api/auth/me";
export type ImpersonatableRole = Exclude<UserRole, "ADMIN">;

export type DevViewState = {
  role: ImpersonatableRole;
  targetLabel: string;
  actorName: string;
};

export type DevViewAccount = {
  isDeveloper: boolean;
  /** Vista emulada ahora mismo, o `null` si el desarrollador se ve a sí mismo. */
  devView: DevViewState | null;
};

function toDevViewState(value: unknown): DevViewState | null {
  const devView = value as Record<string, unknown> | null | undefined;
  const role = devView?.role;
  if (role !== "TECH" && role !== "CUSTOMER") {
    return null;
  }
  return {
    role,
    targetLabel: typeof devView?.targetLabel === "string" ? devView.targetLabel : "",
    actorName: typeof devView?.actorName === "string" ? devView.actorName : "",
  };
}

/**
 * Lee la cuenta activa de `/api/auth/me` sin caché. Ante cualquier fallo
 * devuelve una cuenta sin privilegios: el conmutador y la franja son avisos de
 * UI, la barrera real la aplican los guards de servidor.
 */
export async function fetchDevViewAccount(): Promise<DevViewAccount> {
  try {
    const response = await fetch(ME_ENDPOINT, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Account request failed with status ${response.status}`);
    }
    const payload = (await response.json()) as { user?: Record<string, unknown> } | null;
    const user = payload?.user;
    return {
      isDeveloper: user?.isDeveloper === true,
      devView: toDevViewState(user?.devView),
    };
  } catch {
    return { isDeveloper: false, devView: null };
  }
}

export const DEV_VIEW_SWITCH_ENDPOINT = "/api/developer/view";
const DEV_VIEW_TARGETS_ENDPOINT = "/api/developer/view/targets";
const ROLE_ORDER: readonly UserRole[] = ["ADMIN", "TECH", "CUSTOMER"];

type TargetOption = {
  userId: string;
  label: string;
};

type DevViewTargets = {
  technicians: readonly TargetOption[];
  customers: readonly TargetOption[];
  defaults: Record<ImpersonatableRole, string | null>;
};

type SwitchResponse = {
  redirectTo?: unknown;
};

function toTargetOptions(value: unknown): TargetOption[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const options = value.map((entry) => {
    const record = entry as Record<string, unknown>;
    return typeof record?.userId === "string" && typeof record?.label === "string"
      ? { userId: record.userId, label: record.label }
      : null;
  });
  return options.every((option): option is TargetOption => option !== null)
    ? options
    : null;
}

function toDefaultId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Valida la respuesta de `/targets` antes de usarla (dato externo al componente). */
function parseTargets(payload: unknown): DevViewTargets | null {
  const record = payload as Record<string, unknown> | null;
  const technicians = toTargetOptions(record?.technicians);
  const customers = toTargetOptions(record?.customers);
  if (!technicians || !customers) {
    return null;
  }
  const defaults = (record?.defaults ?? {}) as Record<string, unknown>;
  return {
    technicians,
    customers,
    defaults: {
      TECH: toDefaultId(defaults.TECH),
      CUSTOMER: toDefaultId(defaults.CUSTOMER),
    },
  };
}

/** Cambia la vista y devuelve la ruta a la que navegar. */
export async function requestDevViewSwitch(
  role: UserRole,
  targetUserId?: string
): Promise<string> {
  const response = await fetch(DEV_VIEW_SWITCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(targetUserId ? { role, targetUserId } : { role }),
  });
  if (!response.ok) {
    throw new Error(`Developer view switch failed with status ${response.status}`);
  }
  const body = (await response.json()) as SwitchResponse;
  return typeof body.redirectTo === "string" ? body.redirectTo : ROLE_REDIRECTS[role];
}

type DeveloperViewSwitcherProps = {
  /** Vista activa ahora mismo: el rol emulado, o ADMIN cuando no hay ninguno. */
  activeRole: UserRole;
};

export default function DeveloperViewSwitcher({
  activeRole,
}: DeveloperViewSwitcherProps) {
  const { t } = useI18n();
  const router = useRouter();
  const selectId = useId();
  const [selectedRole, setSelectedRole] = useState<UserRole>(activeRole);
  const [targets, setTargets] = useState<DevViewTargets | null>(null);
  const [targetByRole, setTargetByRole] = useState<Record<ImpersonatableRole, string>>({
    TECH: "",
    CUSTOMER: "",
  });
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(DEV_VIEW_TARGETS_ENDPOINT, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Targets request failed with status ${response.status}`);
        }
        const parsed = parseTargets(await response.json());
        if (!parsed) {
          throw new Error("Unexpected targets payload");
        }
        if (cancelled) {
          return;
        }
        setTargets(parsed);
        setTargetByRole({
          TECH: parsed.defaults.TECH ?? parsed.technicians[0]?.userId ?? "",
          CUSTOMER: parsed.defaults.CUSTOMER ?? parsed.customers[0]?.userId ?? "",
        });
      } catch {
        if (!cancelled) {
          setError(t("devView.errors.load"));
        }
      } finally {
        if (!cancelled) {
          setLoadingTargets(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const options = useMemo<readonly TargetOption[]>(() => {
    if (selectedRole === "TECH") {
      return targets?.technicians ?? [];
    }
    if (selectedRole === "CUSTOMER") {
      return targets?.customers ?? [];
    }
    return [];
  }, [selectedRole, targets]);

  const needsTarget = selectedRole !== "ADMIN";
  const selectedTargetId = needsTarget ? targetByRole[selectedRole] : "";

  const handleApply = async () => {
    setError(null);
    if (needsTarget && !selectedTargetId) {
      setError(t("devView.errors.target"));
      return;
    }
    setSaving(true);
    try {
      const redirectTo = await requestDevViewSwitch(
        selectedRole,
        needsTarget ? selectedTargetId : undefined
      );
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError(t("devView.errors.switch"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-1.5" data-testid="dev-view-switcher">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--sidebar-muted)]">
        {t("devView.title")}
      </p>
      <div
        role="radiogroup"
        aria-label={t("devView.groupLabel")}
        className="grid grid-cols-3 gap-1"
      >
        {ROLE_ORDER.map((role) => {
          const checked = selectedRole === role;
          // `overflow-hidden` + `min-w-0`: en una celda de ~80 px la etiqueta
          // debe recortarse dentro del boton; sin ellos se desborda y tapa el
          // centro del boton contiguo, que deja de ser pulsable.
          return (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={checked}
              data-role={role}
              disabled={saving}
              onClick={() => setSelectedRole(role)}
              className={`sidebar-account-link min-w-0 overflow-hidden px-1 ${
                checked ? "ring-2 ring-sky-300/80" : "opacity-70"
              }`}
            >
              <span className="sidebar-account-icon shrink-0" aria-hidden="true">
                {t(`devView.roleInitials.${role}`)}
              </span>
              <span className="sidebar-account-label min-w-0 truncate">
                {t(`devView.roles.${role}`)}
              </span>
            </button>
          );
        })}
      </div>

      {needsTarget ? (
        <div className="grid gap-1">
          <label
            htmlFor={selectId}
            className="text-[11px] font-medium text-[color:var(--sidebar-muted)]"
          >
            {t("devView.targetLabel")}
          </label>
          <select
            id={selectId}
            value={selectedTargetId}
            disabled={saving || loadingTargets || options.length === 0}
            onChange={(event) =>
              setTargetByRole((current) => ({
                ...current,
                [selectedRole]: event.target.value,
              }))
            }
            className="w-full min-w-0 rounded-xl border border-white/20 bg-white/10 px-2 py-1.5 text-[0.72rem] font-semibold text-[color:var(--sidebar-ink)] disabled:opacity-60"
          >
            <option value="" className="text-slate-900">
              {loadingTargets ? t("devView.loading") : t("devView.targetPlaceholder")}
            </option>
            {options.map((option) => (
              <option key={option.userId} value={option.userId} className="text-slate-900">
                {option.label}
              </option>
            ))}
          </select>
          {!loadingTargets && options.length === 0 ? (
            <p className="text-[11px] leading-snug text-[color:var(--sidebar-muted)]">
              {t("devView.targetEmpty")}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleApply}
        disabled={saving}
        data-testid="dev-view-apply"
        className="sidebar-account-link"
      >
        <span className="sidebar-account-label">
          {saving ? t("devView.applying") : t("devView.apply")}
        </span>
      </button>

      {error ? (
        <p role="alert" className="text-[11px] leading-snug text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Conmutador que resuelve por su cuenta si debe mostrarse. Lo usa el drawer
 * móvil de `AppShell`, que no dispone del `/api/auth/me` sin caché que ya hace
 * `SidebarAccount` en escritorio.
 */
export function DeveloperViewSwitcherPanel() {
  const [account, setAccount] = useState<DevViewAccount | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDevViewAccount().then((next) => {
      if (!cancelled) {
        setAccount(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!account || !(account.isDeveloper || account.devView)) {
    return null;
  }
  return <DeveloperViewSwitcher activeRole={account.devView?.role ?? "ADMIN"} />;
}
