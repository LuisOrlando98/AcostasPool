"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/client";

type ReportsFiltersBarProps = {
  technicians: Array<{ id: string; name: string }>;
  defaults: {
    range: string;
    from: string;
    to: string;
    technicianId?: string;
    serviceType?: string;
    priority?: string;
  };
};

type FilterState = {
  range: string;
  from: string;
  to: string;
  technicianId: string;
  serviceType: string;
  priority: string;
};

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildPresetRange(range: string) {
  const now = new Date();
  const today = formatInputDate(now);

  if (range === "today") {
    return { from: today, to: today };
  }

  const days = Number(range);
  if (!Number.isNaN(days) && days > 0) {
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    return { from: formatInputDate(start), to: today };
  }

  return { from: today, to: today };
}

function normalizeRangeLabel(range: string) {
  if (range === "today") return "today";
  if (range === "7" || range === "15" || range === "30" || range === "90") {
    return range;
  }
  return "custom";
}

export default function ReportsFiltersBar({
  technicians,
  defaults,
}: ReportsFiltersBarProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FilterState>({
    range: defaults.range,
    from: defaults.from,
    to: defaults.to,
    technicianId: defaults.technicianId ?? "",
    serviceType: defaults.serviceType ?? "",
    priority: defaults.priority ?? "",
  });
  const [draft, setDraft] = useState<FilterState>(state);

  useEffect(() => {
    const nextState: FilterState = {
      range: defaults.range,
      from: defaults.from,
      to: defaults.to,
      technicianId: defaults.technicianId ?? "",
      serviceType: defaults.serviceType ?? "",
      priority: defaults.priority ?? "",
    };
    setState(nextState);
    if (!open) {
      setDraft(nextState);
    }
  }, [
    defaults.from,
    defaults.priority,
    defaults.range,
    defaults.serviceType,
    defaults.technicianId,
    defaults.to,
    open,
  ]);

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
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = original;
    };
  }, [open]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (normalizeRangeLabel(state.range) !== "30") count += 1;
    if (state.technicianId) count += 1;
    if (state.serviceType) count += 1;
    if (state.priority) count += 1;
    return count;
  }, [state.priority, state.range, state.serviceType, state.technicianId]);

  const rangeLabel = useMemo(() => {
    const normalized = normalizeRangeLabel(state.range);
    if (normalized === "today") return t("admin.reports.filters.rangeToday");
    if (normalized === "7") return t("admin.reports.filters.range7");
    if (normalized === "15") return t("admin.reports.filters.range15");
    if (normalized === "30") return t("admin.reports.filters.range30");
    if (normalized === "90") return t("admin.reports.filters.range90");
    return t("admin.reports.filters.rangeCustom");
  }, [state.range, t]);

  const dateLabel = useMemo(() => {
    const from = state.from ? new Date(`${state.from}T00:00:00`) : null;
    const to = state.to ? new Date(`${state.to}T00:00:00`) : null;
    if (!from || Number.isNaN(from.getTime()) || !to || Number.isNaN(to.getTime())) {
      return "--";
    }
    return `${from.toLocaleDateString()} - ${to.toLocaleDateString()}`;
  }, [state.from, state.to]);

  const pushState = (next: FilterState) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("logsPage");
    params.delete("status");
    params.delete("type");

    const normalized = normalizeRangeLabel(next.range);
    if (normalized === "custom") {
      if (next.from) {
        params.set("from", next.from);
      } else {
        params.delete("from");
      }
      if (next.to) {
        params.set("to", next.to);
      } else {
        params.delete("to");
      }
      params.delete("range");
    } else {
      params.set("range", normalized);
      params.delete("from");
      params.delete("to");
    }

    if (next.technicianId) {
      params.set("technicianId", next.technicianId);
    } else {
      params.delete("technicianId");
    }
    if (next.serviceType) {
      params.set("serviceType", next.serviceType);
    } else {
      params.delete("serviceType");
    }
    if (next.priority) {
      params.set("priority", next.priority);
    } else {
      params.delete("priority");
    }

    const query = params.toString();
    const nextHref = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  };

  const applyDraft = () => {
    const next = { ...draft };
    if (normalizeRangeLabel(next.range) === "custom") {
      if (!next.from && next.to) {
        next.from = next.to;
      }
      if (!next.to && next.from) {
        next.to = next.from;
      }
      if (!next.from || !next.to) {
        const preset = buildPresetRange("30");
        next.range = "30";
        next.from = preset.from;
        next.to = preset.to;
      }
      if (next.from > next.to) {
        next.to = next.from;
      }
    }

    setState(next);
    pushState(next);
    setOpen(false);
  };

  const clearReports = () => {
    const preset = buildPresetRange("30");
    const clean: FilterState = {
      range: "30",
      from: preset.from,
      to: preset.to,
      technicianId: "",
      serviceType: "",
      priority: "",
    };
    setDraft(clean);
    setState(clean);
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
    setOpen(false);
  };

  const setPreset = (range: string) => {
    const preset = buildPresetRange(range);
    setDraft((current) => ({
      ...current,
      range,
      from: preset.from,
      to: preset.to,
    }));
  };

  return (
    <section className="ui-panel p-4 shadow-contrast sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t("admin.reports.filters.toolbar")}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-semibold">{rangeLabel}</span>
            <span className="mx-2 text-slate-400">|</span>
            <span className="text-slate-600">{dateLabel}</span>
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {activeCount > 0 ? (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {t("admin.reports.filters.activeCount", { count: activeCount })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setDraft(state);
              setOpen(true);
            }}
            className="app-button-primary w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] sm:w-auto"
          >
            {t("admin.reports.filters.open")}
          </button>
        </div>
      </div>

      {isPending ? (
        <p className="mt-2 text-[11px] text-slate-500">{t("common.feedback.updating")}</p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={t("common.actions.close")}
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t("admin.reports.filters.toolbar")}
                  </p>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {t("admin.reports.filters.modalTitle")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {t("admin.reports.filters.modalSubtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
                >
                  {t("common.actions.close")}
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-5">
                <section>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.reports.filters.range")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[
                      { value: "30", label: t("admin.reports.filters.range30") },
                      { value: "15", label: t("admin.reports.filters.range15") },
                      { value: "7", label: t("admin.reports.filters.range7") },
                      { value: "today", label: t("admin.reports.filters.rangeToday") },
                      { value: "custom", label: t("admin.reports.filters.rangeCustom") },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() =>
                          preset.value === "custom"
                            ? setDraft((current) => ({ ...current, range: "custom" }))
                            : setPreset(preset.value)
                        }
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          normalizeRangeLabel(draft.range) === preset.value
                            ? "border-sky-300 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </section>

                {normalizeRangeLabel(draft.range) === "custom" ? (
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {t("admin.reports.filters.dateRange")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        {t("admin.reports.filters.from")}
                        <input
                          type="date"
                          value={draft.from}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              range: "custom",
                              from: event.target.value,
                            }))
                          }
                          className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        {t("admin.reports.filters.to")}
                        <input
                          type="date"
                          value={draft.to}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              range: "custom",
                              to: event.target.value,
                            }))
                          }
                          className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                  </section>
                ) : null}

                <section className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-600">
                    {t("admin.reports.filters.technician")}
                    <select
                      value={draft.technicianId}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          technicianId: event.target.value,
                        }))
                      }
                      className="app-input mt-1.5 w-full bg-white px-3 py-2 text-sm"
                    >
                      <option value="">{t("admin.reports.filters.allTechs")}</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold text-slate-600">
                    {t("admin.reports.filters.service")}
                    <select
                      value={draft.serviceType}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          serviceType: event.target.value,
                        }))
                      }
                      className="app-input mt-1.5 w-full bg-white px-3 py-2 text-sm"
                    >
                      <option value="">{t("admin.reports.filters.allServices")}</option>
                      <option value="WEEKLY_CLEANING">
                        {t("jobs.service.weeklyCleaning")}
                      </option>
                      <option value="FILTER_CHECK">{t("jobs.service.filterCheck")}</option>
                      <option value="CHEM_BALANCE">{t("jobs.service.chemBalance")}</option>
                      <option value="EQUIPMENT_CHECK">
                        {t("jobs.service.equipmentCheck")}
                      </option>
                    </select>
                  </label>

                  <label className="text-xs font-semibold text-slate-600">
                    {t("admin.reports.filters.priority")}
                    <select
                      value={draft.priority}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                      className="app-input mt-1.5 w-full bg-white px-3 py-2 text-sm"
                    >
                      <option value="">{t("admin.reports.filters.allPriorities")}</option>
                      <option value="NORMAL">{t("jobs.priority.normal")}</option>
                      <option value="URGENT">{t("jobs.priority.urgent")}</option>
                    </select>
                  </label>
                </section>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <button
                type="button"
                onClick={clearReports}
                className="app-button-secondary w-full px-4 py-2 text-xs font-semibold sm:w-auto"
              >
                {t("admin.reports.filters.reset")}
              </button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="app-button-ghost w-full px-4 py-2 text-xs font-semibold sm:w-auto"
                >
                  {t("common.actions.close")}
                </button>
                <button
                  type="button"
                  onClick={applyDraft}
                  className="app-button-primary w-full px-4 py-2 text-xs font-semibold sm:w-auto"
                >
                  {t("admin.reports.filters.apply")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
