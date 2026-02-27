const SOUND_COOLDOWN_MS = 1200;

type WindowWithNotificationState = Window & {
  __apLastNotificationSignalAt?: number;
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

function playNotificationChime() {
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
  playNotificationChime();
  showSystemNotification(title, body);
}
