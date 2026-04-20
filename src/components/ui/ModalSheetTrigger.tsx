"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ModalSheetTriggerProps = {
  buttonLabel: string;
  buttonClassName?: string;
  modalKicker?: string;
  modalTitle: string;
  modalSubtitle?: string;
  closeLabel?: string;
  children: React.ReactNode;
  disabled?: boolean;
};

export default function ModalSheetTrigger({
  buttonLabel,
  buttonClassName = "app-button-primary cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]",
  modalKicker,
  modalTitle,
  modalSubtitle,
  closeLabel = "Close",
  children,
  disabled,
}: ModalSheetTriggerProps) {
  const [open, setOpen] = useState(false);
  const firstFocusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (firstFocusRef.current) {
      const focusable = firstFocusRef.current.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      focusable?.focus();
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const closeSvg = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={buttonClassName}
      >
        {buttonLabel}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="app-modal-layer fixed inset-0 z-[2200] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
              <button
                type="button"
                aria-label={closeLabel}
                onClick={() => setOpen(false)}
                className="app-modal-backdrop absolute inset-0 bg-slate-900/60 cursor-default"
              />
              <div
                ref={firstFocusRef}
                className="app-modal-card relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                  <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {modalKicker ? (
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                          {modalKicker}
                        </p>
                      ) : null}
                      <h2 className="text-lg font-semibold">{modalTitle}</h2>
                      {modalSubtitle ? (
                        <p className="text-sm text-slate-500">{modalSubtitle}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="app-modal-close"
                      aria-label={closeLabel}
                      title={closeLabel}
                    >
                      {closeSvg}
                    </button>
                  </div>
                  {children}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
