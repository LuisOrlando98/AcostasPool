const SOUND_COOLDOWN_MS = 1200;

/** Clave de localStorage con la preferencia de sonido ("true" | "false"). */
export const NOTIFICATION_SOUND_STORAGE_KEY = "notificationSoundEnabled";
export const NOTIFICATION_SOUND_DEFAULT_ENABLED = true;
/** Evento de ventana emitido al cambiar la preferencia desde esta pestaña. */
const NOTIFICATION_SOUND_CHANGE_EVENT = "ap:notification-sound-change";

type WindowWithNotificationState = Window & {
  __apLastNotificationSignalAt?: number;
  __apNotificationAudio?: HTMLAudioElement | null;
  __apNotificationAudioUrl?: string | null;
  __apNotificationSoundBroken?: boolean;
  /** Última preferencia fijada en esta pestaña (respaldo si localStorage no está disponible). */
  __apNotificationSoundEnabled?: boolean;
};

function canEmitSignal() {
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as WindowWithNotificationState;
  const now = Date.now();
  if (
    typeof w.__apLastNotificationSignalAt === "number" &&
    now - w.__apLastNotificationSignalAt < SOUND_COOLDOWN_MS
  ) {
    return false;
  }
  w.__apLastNotificationSignalAt = now;
  return true;
}

async function playConfiguredAudio() {
  if (typeof window === "undefined") {
    return false;
  }
  const configuredUrl =
    process.env.NEXT_PUBLIC_NOTIFICATION_SOUND_URL?.trim() ||
    "/sounds/notification.mp3";
  if (!configuredUrl) {
    return false;
  }
  const w = window as WindowWithNotificationState;
  if (w.__apNotificationSoundBroken) {
    return false;
  }
  if (!w.__apNotificationAudio || w.__apNotificationAudioUrl !== configuredUrl) {
    w.__apNotificationAudio = new Audio(configuredUrl);
    w.__apNotificationAudioUrl = configuredUrl;
    w.__apNotificationAudio.preload = "auto";
  }
  const audio = w.__apNotificationAudio;
  if (!audio) {
    return false;
  }
  try {
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch (error) {
    const name =
      error instanceof DOMException ? error.name : "UnknownNotificationAudioError";
    if (name === "NotSupportedError") {
      w.__apNotificationSoundBroken = true;
    }
    return false;
  }
}

function playSynthNotificationChime() {
  if (typeof window === "undefined") {
    return;
  }
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }
  const ctx = new AudioContextCtor();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(740, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.12);

  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.24);
  window.setTimeout(() => {
    void ctx.close().catch(() => undefined);
  }, 320);
}

async function playNotificationChime() {
  const played = await playConfiguredAudio();
  if (!played) {
    playSynthNotificationChime();
  }
}

function showSystemNotification(title: string, body: string) {
  if (
    typeof window === "undefined" ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    !document.hidden
  ) {
    return;
  }
  try {
    const notification = new Notification(title, { body });
    setTimeout(() => notification.close(), 5000);
  } catch {
    // Ignore browser permission/runtime failures.
  }
}

/**
 * Interpreta el valor crudo guardado. Solo "false" silencia el sonido; un valor
 * ausente o desconocido conserva el valor por defecto (activado).
 */
export function parseNotificationSoundPreference(
  raw: string | null | undefined
): boolean {
  if (raw === null || raw === undefined) {
    return NOTIFICATION_SOUND_DEFAULT_ENABLED;
  }
  return raw !== "false";
}

function readStoredSoundPreference(): string | null {
  try {
    return window.localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY);
  } catch {
    // localStorage bloqueado (modo privado, políticas del navegador).
    return null;
  }
}

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") {
    return NOTIFICATION_SOUND_DEFAULT_ENABLED;
  }
  const stored = readStoredSoundPreference();
  if (stored !== null) {
    return parseNotificationSoundPreference(stored);
  }
  const w = window as WindowWithNotificationState;
  return w.__apNotificationSoundEnabled ?? NOTIFICATION_SOUND_DEFAULT_ENABLED;
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  const w = window as WindowWithNotificationState;
  w.__apNotificationSoundEnabled = enabled;
  try {
    window.localStorage.setItem(
      NOTIFICATION_SOUND_STORAGE_KEY,
      enabled ? "true" : "false"
    );
  } catch {
    // Sin persistencia disponible: la preferencia se conserva en memoria durante la sesión.
  }
  window.dispatchEvent(new Event(NOTIFICATION_SOUND_CHANGE_EVENT));
}

/**
 * Suscripción a cambios de la preferencia (en esta pestaña y, vía `storage`,
 * en otras). Compatible con `useSyncExternalStore`.
 */
export function subscribeToNotificationSoundPreference(
  listener: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener(NOTIFICATION_SOUND_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(NOTIFICATION_SOUND_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function emitNotificationSignal({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  if (!canEmitSignal()) {
    return;
  }
  if (isNotificationSoundEnabled()) {
    void playNotificationChime();
  }
  showSystemNotification(title, body);
}
