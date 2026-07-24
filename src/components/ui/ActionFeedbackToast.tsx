"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ActionFeedbackToastProps = {
  message: string;
  dismissLabel?: string;
  tone?: "success" | "error";
};

export default function ActionFeedbackToast({
  message,
  dismissLabel = "Close",
  tone = "success",
}: ActionFeedbackToastProps) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), tone === "error" ? 8000 : 3200);

    return () => clearTimeout(timer);
  }, [message, tone]);

  if (!message || !visible || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-3 top-24 z-[2800] flex justify-center sm:inset-x-6 sm:justify-end">
      <div
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-[1.6rem] border bg-white/96 px-4 py-3 text-sm text-slate-700 shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl ${
          tone === "error" ? "border-rose-200/80" : "border-emerald-200/80"
        }`}
      >
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            tone === "error" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {tone === "error" ? (
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v5m0 3h.01M10 2l8 16H2L10 2z" />
            </svg>
          ) : (
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
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
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
