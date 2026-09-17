"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type ActionErrorToastProps = {
  message: string;
  dismissLabel?: string;
};

/**
 * Toast de error para acciones lanzadas desde componentes que aún no usan
 * useActionState (llegan por `?feedback=action-error&error=...`). A diferencia
 * de ActionFeedbackToast no se autocierra: el usuario debe leerlo.
 */
export default function ActionErrorToast({
  message,
  dismissLabel = "Close",
}: ActionErrorToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const [previousMessage, setPreviousMessage] = useState(message);

  if (message !== previousMessage) {
    setPreviousMessage(message);
    setDismissed(false);
  }

  const visible = Boolean(message) && !dismissed;
  if (!visible || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-3 top-24 z-[2800] flex justify-center sm:inset-x-6 sm:justify-end">
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-[1.6rem] border border-rose-200/80 bg-white/96 px-4 py-3 text-sm text-slate-700 shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl"
      >
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v5M10 13.5v.5" />
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
