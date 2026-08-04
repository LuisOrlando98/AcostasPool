"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/client";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";
import {
  addBusinessDays,
  formatBusinessDateInput,
  formatInBusinessTimeZone,
  parseBusinessDateInput,
} from "@/lib/timezone";

type AccountingFiltersBarProps = {
  defaults: { range: string; from: string; to: string };
  exportHref: string;
};

type FilterState = { range: string; from: string; to: string };

function buildPresetRange(range: string) {
  const now = new Date();
  const today = formatBusinessDateInput(now);
  const days = Number(range);
  if (!Number.isNaN(days) && days > 0) {
    const start = addBusinessDays(now, -(days - 1)) ?? now;
    return { from: formatBusinessDateInput(start), to: today };
  }
  return { from: today, to: today };
}

function normalizeRangeLabel(range: string) {
  if (["7", "30", "90", "365"].includes(range)) {
    return range;
  }
  return "custom";
}

export default function AccountingFiltersBar({ defaults, exportHref }: AccountingFiltersBarProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FilterState>(defaults);
  const [draft, setDraft] = useState<FilterState>(defaults);

  useEffect(() => {
    setState(defaults);
    if (!open) {
      setDraft(defaults);
    }
  }, [defaults, open]);

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
    const unlock = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlock();
    };
  }, [open]);

  const rangeLabel = useMemo(() => {
    const normalized = normalizeRangeLabel(state.range);
    if (normalized === "7") return t("admin.accounting.filters.range7");
    if (normalized === "30") return t("admin.accounting.filters.range30");
    if (normalized === "90") return t("admin.accounting.filters.range90");
    if (normalized === "365") return t("admin.accounting.filters.range365");
    return t("admin.accounting.filters.rangeCustom");
  }, [state.range, t]);

  const dateLabel = useMemo(() => {
    const from = state.from ? parseBusinessDateInput(state.from) : null;
    const to = state.to ? parseBusinessDateInput(state.to) : null;
    if (!from || Number.isNaN(from.getTime()) || !to || Number.isNaN(to.getTime())) {
      return "--";
    }
    return `${formatInBusinessTimeZone(from, locale, { dateStyle: "short" })} - ${formatInBusinessTimeZone(to, locale, { dateStyle: "short" })}`;
  }, [locale, state.from, state.to]);

  const pushState = (next: FilterState) => {
    const params = new URLSearchParams(searchParams.toString());
    const normalized = normalizeRangeLabel(next.range);
    if (normalized === "custom") {
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
      params.delete("range");
    } else {
      params.set("range", normalized);
      params.delete("from");
      params.delete("to");
    }
    const query = params.toString();
    const nextHref = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  };

  const setPreset = (range: string) => {
    const preset = buildPresetRange(range);
    const next = { range, from: preset.from, to: preset.to };
    setDraft(next);
    setState(next);
    pushState(next);
    setOpen(false);
  };

  const applyCustomDraft = () => {
    let next = { ...draft, range: "custom" };
    if (!next.from && next.to) next.from = next.to;
    if (!next.to && next.from) next.to = next.from;
    if (!next.from || !next.to) {
      next = { range: "365", ...buildPresetRange("365") };
    }
    if (next.from > next.to) {
      next.to = next.from;
    }
    setState(next);
    pushState(next);
    setOpen(false);
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <p className="min-w-0 flex-1 truncate whitespace-nowrap pr-1 text-[13px] text-slate-700 sm:text-sm">
          <span className="font-semibold">{t("admin.accounting.filters.showing")}:</span>
          <span className="ml-1.5 font-semibold sm:ml-2">{rangeLabel}</span>
          <span className="mx-1.5 text-slate-400 sm:mx-2">-</span>
          <span className="text-slate-600">{dateLabel}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={exportHref}
          className="app-button-secondary px-3 py-1.5 text-xs font-semibold"
        >
          {t("admin.accounting.filters.export")}
        </a>
        <button
          type="button"
          onClick={() => {
            setDraft(state);
            setOpen(true);
          }}
          className="app-button-ghost relative inline-flex h-9 w-9 items-center justify-center rounded-full p-0"
          aria-label={t("admin.accounting.filters.open")}
          title={t("admin.accounting.filters.open")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </button>
      </div>

      {isPending ? (
        <p className="w-full text-[11px] text-slate-500">{t("common.feedback.updating")}</p>
      ) : null}

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[2600] flex items-center justify-center bg-slate-900/50 p-3 sm:p-6">
              <button
                type="button"
                className="absolute inset-0"
                aria-label={t("common.actions.close")}
                onClick={() => setOpen(false)}
              />
              <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t("admin.accounting.filters.toolbar")}
                  </p>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {t("admin.accounting.filters.modalTitle")}
                  </h2>
                </div>

                <div className="px-4 py-4 sm:px-6">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { value: "7", label: t("admin.accounting.filters.range7") },
                      { value: "30", label: t("admin.accounting.filters.range30") },
                      { value: "90", label: t("admin.accounting.filters.range90") },
                      { value: "365", label: t("admin.accounting.filters.range365") },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setPreset(preset.value)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          normalizeRangeLabel(state.range) === preset.value
                            ? "border-sky-300 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {t("admin.accounting.filters.customRange")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        {t("admin.accounting.filters.from")}
                        <input
                          type="date"
                          value={draft.from}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, from: event.target.value }))
                          }
                          className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        {t("admin.accounting.filters.to")}
                        <input
                          type="date"
                          value={draft.to}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, to: event.target.value }))
                          }
                          className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={applyCustomDraft}
                      className="app-button-primary mt-3 w-full px-4 py-2 text-xs font-semibold"
                    >
                      {t("admin.accounting.filters.apply")}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
