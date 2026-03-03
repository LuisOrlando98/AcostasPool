"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  idleLabel: string;
  pendingLabel?: string;
  successLabel?: string;
  successDurationMs?: number;
  className?: string;
};

export default function FormSubmitButton({
  idleLabel,
  pendingLabel = "Saving...",
  successLabel,
  successDurationMs = 1800,
  className = "",
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitIntent, setSubmitIntent] = useState(false);
  const [pendingStarted, setPendingStarted] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    setSubmitIntent(true);
  };

  useEffect(() => {
    if (pending && submitIntent) {
      setPendingStarted(true);
      return;
    }
    if (!pending && submitIntent && pendingStarted) {
      setShowSuccess(true);
      setSubmitIntent(false);
      setPendingStarted(false);
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => {
        setShowSuccess(false);
      }, successDurationMs);
    }
  }, [pending, submitIntent, pendingStarted, successDurationMs]);

  useEffect(() => {
    if (pending) {
      setShowSuccess(false);
    }
  }, [pending]);

  useEffect(() => {
    if (!submitIntent || pending) {
      return;
    }
    const resetIntentTimer = setTimeout(() => {
      setSubmitIntent(false);
      setPendingStarted(false);
    }, 3500);
    return () => clearTimeout(resetIntentTimer);
  }, [submitIntent, pending]);

  useEffect(
    () => () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    },
    []
  );

  return (
    <button
      type="submit"
      onClick={handleClick}
      disabled={pending}
      className={`app-button-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          {pendingLabel}
        </span>
      ) : showSuccess ? (
        <span className="inline-flex items-center gap-2">
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
          {successLabel ?? idleLabel}
        </span>
      ) : (
        idleLabel
      )}
    </button>
  );
}
