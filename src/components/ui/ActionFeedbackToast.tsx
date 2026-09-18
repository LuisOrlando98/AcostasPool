"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ActionFeedbackTone = "success" | "error";

// WCAG 2.2.1: tiempo suficiente para leer el aviso; además se pausa con hover/foco.
// Un error se deja más tiempo en pantalla: el usuario suele necesitar releerlo.
const AUTO_DISMISS_MS: Record<ActionFeedbackTone, number> = {
  success: 6000,
  error: 8000,
};

type ActionFeedbackToastProps = {
  message: string;
  dismissLabel?: string;
  /** "error" anuncia con role="alert" y usa la paleta rosa; por defecto "success". */
  tone?: ActionFeedbackTone;
};

type DismissTiming = {
  readonly message: string;
  readonly remainingMs: number;
};

const TONE_CLASSES: Record<ActionFeedbackTone, { border: string; icon: string }> = {
  success: {
    border: "border-emerald-200/80",
    icon: "bg-emerald-100 text-emerald-700",
  },
  error: {
    border: "border-rose-200/80",
    icon: "bg-rose-100 text-rose-700",
  },
};

function ToneIcon({ tone }: { tone: ActionFeedbackTone }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      {tone === "error" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 5v6m0 3.5h.01" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
      )}
    </svg>
  );
}

export default function ActionFeedbackToast({
  message,
  dismissLabel = "Close",
  tone = "success",
}: ActionFeedbackToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [previousMessage, setPreviousMessage] = useState(message);
  const timingRef = useRef<DismissTiming>({ message, remainingMs: AUTO_DISMISS_MS[tone] });

  // A new message re-opens the toast: derive it from the previous render
  // instead of syncing state inside an effect.
  if (message !== previousMessage) {
    setPreviousMessage(message);
    setDismissed(false);
  }

  // The countdown only runs while the toast is not hovered/focused; pausing
  // keeps the remaining time so the total never exceeds AUTO_DISMISS_MS.
  useEffect(() => {
    if (!message || paused) {
      return;
    }
    if (timingRef.current.message !== message) {
      timingRef.current = { message, remainingMs: AUTO_DISMISS_MS[tone] };
    }
    const startedAt = Date.now();
    const timer = setTimeout(() => setDismissed(true), timingRef.current.remainingMs);
    return () => {
      clearTimeout(timer);
      const elapsed = Date.now() - startedAt;
      timingRef.current = {
        message,
        remainingMs: Math.max(0, timingRef.current.remainingMs - elapsed),
      };
    };
  }, [message, paused, tone]);

  const visible = Boolean(message) && !dismissed;

  if (!visible || typeof document === "undefined") {
    return null;
  }

  const toneClasses = TONE_CLASSES[tone];
  const isError = tone === "error";

  return createPortal(
    <div className="pointer-events-none fixed inset-x-3 top-24 z-[2800] flex justify-center sm:inset-x-6 sm:justify-end">
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-[1.6rem] border ${toneClasses.border} bg-white/96 px-4 py-3 text-sm text-slate-700 shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl`}
      >
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneClasses.icon}`}
        >
          <ToneIcon tone={tone} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
          aria-label={dismissLabel}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
}
