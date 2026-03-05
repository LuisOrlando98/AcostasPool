"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "@/i18n/client";

type DocumentPreviewModalProps = {
  srcDoc: string;
  title: string;
  previewLabel: string;
  previewHint: string;
  openLabel: string;
};

export default function DocumentPreviewModal({
  srcDoc,
  title,
  previewLabel,
  previewHint,
  openLabel,
}: DocumentPreviewModalProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const frameId = useId();
  const closeLabel = t("common.actions.close");

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-sky-300 hover:bg-white sm:p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {previewLabel}
          </p>
          <span className="text-[11px] font-semibold text-sky-700">{openLabel}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{previewHint}</p>

        <div className="mt-3 flex justify-center">
          <div className="relative aspect-[210/297] w-full max-w-[20rem] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg">
            <div
              className="pointer-events-none absolute inset-0 origin-top-left scale-[0.5]"
              style={{ width: "200%", height: "200%" }}
            >
              <iframe
                title={`${title}-${frameId}-thumbnail`}
                className="h-full w-full border-0 bg-white"
                sandbox=""
                srcDoc={srcDoc}
              />
            </div>
          </div>
        </div>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/75 p-2 sm:p-6">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
            aria-label={closeLabel}
          />
          <div className="relative z-10 w-[min(96vw,78rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl sm:p-3">
            <div className="mb-2 flex items-center justify-between px-1 sm:px-2">
              <p className="text-sm font-semibold text-slate-800">{title}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                aria-label={closeLabel}
                title={closeLabel}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 6l12 12M18 6l-12 12"
                  />
                </svg>
              </button>
            </div>
            <iframe
              title={`${title}-${frameId}-modal`}
              className="h-[86vh] w-full rounded-xl border border-slate-200 bg-white"
              sandbox=""
              srcDoc={srcDoc}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
