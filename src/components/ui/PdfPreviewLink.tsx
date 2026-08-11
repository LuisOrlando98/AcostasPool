"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type PdfPreviewLinkProps = {
  href: string;
  label: string;
  title: string;
  closeLabel: string;
  className?: string;
};

export default function PdfPreviewLink({
  href,
  label,
  title,
  closeLabel,
  className = "text-xs text-slate-600 underline",
}: PdfPreviewLinkProps) {
  const [open, setOpen] = useState(false);

  const modal =
    typeof document !== "undefined" && open
      ? createPortal(
          <div className="app-modal-layer fixed inset-0 z-[2400] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
              aria-label={closeLabel}
            />
            <div className="app-modal-card relative z-10 flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="app-modal-close"
                  aria-label={closeLabel}
                  title={closeLabel}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </div>
              <iframe src={href} title={title} className="w-full flex-1 border-0 bg-white" />
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {modal}
    </>
  );
}
