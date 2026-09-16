"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const AUTO_DISMISS_MS = 3200;

type ActionFeedbackToastProps = {
  message: string;
  dismissLabel?: string;
};

export default function ActionFeedbackToast({
  message,
  dismissLabel = "Close",
}: ActionFeedbackToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const [previousMessage, setPreviousMessage] = useState(message);

  // A new message re-opens the toast: derive it from the previous render
  // instead of syncing state inside an effect.
  if (message !== previousMessage) {
    setPreviousMessage(message);
    setDismissed(false);
  }

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const visible = Boolean(message) && !dismissed;

  if (!visible || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-3 top-24 z-[2800] flex justify-center sm:inset-x-6 sm:justify-end">
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-[1.6rem] border border-emerald-200/80 bg-white/96 px-4 py-3 text-sm text-slate-700 shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
          </svg>
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
