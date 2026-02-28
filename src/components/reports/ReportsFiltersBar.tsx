"use client";

import { useMemo, useState, useTransition } from "react";
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

export default function ReportsFiltersBar({
  technicians,
  defaults,
}: ReportsFiltersBarProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [dateOpen, setDateOpen] = useState(false);
  const [state, setState] = useState<FilterState>({
    range: defaults.range,
    from: defaults.from,
    to: defaults.to,
    technicianId: defaults.technicianId ?? "",
    serviceType: defaults.serviceType ?? "",
    priority: defaults.priority ?? "",
  });

  const dateLabel = useMemo(() => {
    const from = state.from ? new Date(`${state.from}T00:00:00`) : null;
    const to = state.to ? new Date(`${state.to}T00:00:00`) : null;
    if (!from || Number.isNaN(from.getTime()) || !to || Number.isNaN(to.getTime())) {
      return t("admin.reports.filters.rangeCustom");
    }
    return `${from.toLocaleDateString()} - ${to.toLocaleDateString()}`;
  }, [state.from, state.to, t]);

  const pushState = (next: FilterState) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("logsPage");
    params.delete("status");
    params.delete("type");

    if (next.range === "custom") {
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
      params.set("range", next.range);
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

  const update = (patch: Partial<FilterState>) => {
    const next = { ...state, ...patch };
    if (next.range === "custom" && next.from && next.to && next.from > next.to) {
      next.to = next.from;
    }
    setState(next);
    pushState(next);
  };

  return (
    <section className="ui-panel p-4 shadow-contrast sm:p-5">
      <div className="ui-filter-bar rounded-2xl p-2.5 sm:p-3">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
          <div className="ui-filter-chip-label min-h-[2.2rem] shrink-0">
            <span className="ui-filter-chip-dot" aria-hidden="true" />
            {t("admin.reports.filters.toolbar")}
          </div>

          <label className="ui-filter-pill min-h-[2.2rem] min-w-[9.8rem] shrink-0">
            <span>{t("admin.reports.filters.range")}</span>
            <select
              value={state.range}
              onChange={(event) => {
                const value = event.target.value;
                update({ range: value });
                if (value === "custom") {
                  setDateOpen(true);
                }
              }}
              className="ui-filter-select min-w-[5.6rem]"
            >
              <option value="7">{t("admin.reports.filters.range7")}</option>
              <option value="30">{t("admin.reports.filters.range30")}</option>
              <option value="90">{t("admin.reports.filters.range90")}</option>
              <option value="custom">{t("admin.reports.filters.rangeCustom")}</option>
            </select>
          </label>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setDateOpen((value) => !value)}
              className="ui-filter-pill min-h-[2.2rem] min-w-[13rem] justify-between"
              aria-expanded={dateOpen}
            >
              <span>{t("admin.reports.filters.dateRange")}</span>
              <span className="truncate text-xs font-semibold text-slate-700">
                {dateLabel}
              </span>
            </button>
            {dateOpen ? (
              <div className="absolute left-0 top-[calc(100%+0.45rem)] z-20 w-[18.5rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                <div className="grid gap-2.5">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("admin.reports.filters.from")}
                    <input
                      type="date"
                      value={state.from}
                      onChange={(event) =>
                        update({ range: "custom", from: event.target.value })
                      }
                      className="app-input mt-1.5 w-full px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("admin.reports.filters.to")}
                    <input
                      type="date"
                      value={state.to}
                      onChange={(event) =>
                        update({ range: "custom", to: event.target.value })
                      }
                      className="app-input mt-1.5 w-full px-3 py-2 text-xs"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDateOpen(false)}
                    className="app-button-secondary px-3 py-1.5 text-xs font-semibold"
                  >
                    {t("common.actions.close")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <label className="ui-filter-pill min-h-[2.2rem] min-w-[10.4rem] shrink-0">
            <span>{t("admin.reports.filters.technician")}</span>
            <select
              value={state.technicianId}
              onChange={(event) => update({ technicianId: event.target.value })}
              className="ui-filter-select min-w-[6.5rem]"
            >
              <option value="">{t("admin.reports.filters.allTechs")}</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-filter-pill min-h-[2.2rem] min-w-[10.2rem] shrink-0">
            <span>{t("admin.reports.filters.service")}</span>
            <select
              value={state.serviceType}
              onChange={(event) => update({ serviceType: event.target.value })}
              className="ui-filter-select min-w-[6.4rem]"
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

          <label className="ui-filter-pill min-h-[2.2rem] min-w-[10rem] shrink-0">
            <span>{t("admin.reports.filters.priority")}</span>
            <select
              value={state.priority}
              onChange={(event) => update({ priority: event.target.value })}
              className="ui-filter-select min-w-[6.2rem]"
            >
              <option value="">{t("admin.reports.filters.allPriorities")}</option>
              <option value="NORMAL">{t("jobs.priority.normal")}</option>
              <option value="URGENT">{t("jobs.priority.urgent")}</option>
            </select>
          </label>

          <a
            href="/admin/reports"
            className="app-button-secondary shrink-0 px-3 py-2 text-xs font-semibold"
          >
            {t("admin.reports.filters.reset")}
          </a>
        </div>

        {isPending ? (
          <p className="px-1 pt-2 text-[11px] text-slate-500">
            {t("common.feedback.updating")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
