"use client";

import { useState, type ReactNode } from "react";

type CollapsibleSectionProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  headerExtra?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export default function CollapsibleSection({
  title,
  subtitle,
  headerExtra,
  defaultOpen = true,
  className = "",
  bodyClassName = "",
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`customers-panel ui-panel p-4 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-transform duration-200 ${
              open ? "" : "-rotate-90"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3.5 w-3.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold text-slate-900">{title}</span>
            {subtitle ? (
              <span className="block text-sm text-slate-500">{subtitle}</span>
            ) : null}
          </span>
        </button>
        {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
      </div>
      {open ? <div className={`mt-4 ${bodyClassName}`}>{children}</div> : null}
    </section>
  );
}
