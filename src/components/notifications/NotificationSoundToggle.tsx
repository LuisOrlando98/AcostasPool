"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";
import {
  NOTIFICATION_SOUND_DEFAULT_ENABLED,
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
  subscribeToNotificationSoundPreference,
} from "@/lib/notifications/client-alert";

const readServerSnapshot = () => NOTIFICATION_SOUND_DEFAULT_ENABLED;

/** Preferencia de sonido reactiva (localStorage + evento de cambio, también entre pestañas). */
function useNotificationSoundEnabled(): boolean {
  return useSyncExternalStore(
    subscribeToNotificationSoundPreference,
    isNotificationSoundEnabled,
    readServerSnapshot
  );
}

const BUTTON_BASE_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:border-slate-300 hover:bg-slate-100";
const BUTTON_STATE_CLASS: Record<"on" | "off", string> = {
  on: "text-slate-700",
  off: "text-slate-400 hover:text-slate-600",
};

function SoundOnIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
      />
    </svg>
  );
}

function SoundOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
      />
    </svg>
  );
}

export type NotificationSoundToggleProps = {
  readonly className?: string;
};

/**
 * Botón conmutador (aria-pressed) que activa o silencia el sonido de las
 * notificaciones en vivo. El nombre accesible es fijo; el estado lo expone
 * `aria-pressed` y el `title` lo muestra como tooltip.
 */
export default function NotificationSoundToggle({
  className,
}: NotificationSoundToggleProps) {
  const { t } = useI18n();
  const enabled = useNotificationSoundEnabled();
  const stateLabel = t(
    enabled ? "layout.notifications.soundOn" : "layout.notifications.soundOff"
  );
  const stateClass = BUTTON_STATE_CLASS[enabled ? "on" : "off"];

  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={t("layout.notifications.soundToggle")}
      title={stateLabel}
      onClick={() => setNotificationSoundEnabled(!enabled)}
      className={`${BUTTON_BASE_CLASS} ${stateClass}${className ? ` ${className}` : ""}`}
    >
      {enabled ? <SoundOnIcon /> : <SoundOffIcon />}
    </button>
  );
}
