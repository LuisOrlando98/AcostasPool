"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

const DEFAULT_SUCCESS_DURATION_MS = 1800;
const SUBMIT_INTENT_RESET_MS = 3500;

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
  successDurationMs = DEFAULT_SUCCESS_DURATION_MS,
  className = "",
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitIntent, setSubmitIntent] = useState(false);
  const [pendingStarted, setPendingStarted] = useState(false);
  const [previousPending, setPreviousPending] = useState(pending);

  const handleClick = () => {
    setSubmitIntent(true);
  };

  // `pending` comes from useFormStatus (an external system): its transitions
  // are tracked during render instead of inside an effect.
  if (pending !== previousPending) {
    setPreviousPending(pending);
    if (pending) {
      setShowSuccess(false);
      if (submitIntent) {
        setPendingStarted(true);
      }
    } else if (submitIntent && pendingStarted) {
      setShowSuccess(true);
      setSubmitIntent(false);
      setPendingStarted(false);
    }
  }

  useEffect(() => {
    if (!showSuccess) {
      return;
    }
    const successTimer = setTimeout(() => {
      setShowSuccess(false);
    }, successDurationMs);
    return () => clearTimeout(successTimer);
  }, [showSuccess, successDurationMs]);

  useEffect(() => {
    if (!submitIntent || pending) {
      return;
    }
    const resetIntentTimer = setTimeout(() => {
      setSubmitIntent(false);
      setPendingStarted(false);
    }, SUBMIT_INTENT_RESET_MS);
    return () => clearTimeout(resetIntentTimer);
  }, [submitIntent, pending]);

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
