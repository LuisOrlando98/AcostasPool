"use client";

import { useMemo, useState } from "react";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import { useI18n } from "@/i18n/client";

type PlanRow = {
  id: string;
  name: string;
  propertyAddress: string;
  frequency: string;
  serviceType: string;
  serviceTierName?: string | null;
  priority: string;
  nextRunAt: string;
  preferredTime: string | null;
  technicianName: string;
  isActive: boolean;
  notes: string | null;
  customerId: string;
};

type CustomerPlansTableProps = {
  rows: PlanRow[];
  onToggle: (formData: FormData) => Promise<void>;
  onCreateJob: (formData: FormData) => Promise<void>;
  actionTargetId?: string;
};

const formatDate = (value: string, locale: string) =>
  new Date(value).toLocaleDateString(locale, {
    dateStyle: "medium",
  });

const formatTime = (value: string, locale: string) =>
  new Date(value).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

const toDateInput = (value: string) =>
  new Date(value).toLocaleDateString("en-CA");

export default function CustomerPlansTable({
  rows,
  onToggle,
  onCreateJob,
  actionTargetId,
}: CustomerPlansTableProps) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [frequencyFilter, setFrequencyFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [techFilter, setTechFilter] = useState("ALL");

  const frequencyLabel = (value: string) => {
    if (value === "BIWEEKLY") return t("plans.frequency.biweekly");
    if (value === "MONTHLY") return t("plans.frequency.monthly");
    return t("plans.frequency.weekly");
  };

  const technicianOptions = useMemo(() => {
    const names = rows.map((row) => row.technicianName).filter(Boolean);
    return Array.from(new Set(names));
  }, [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL") {
        const active = row.isActive ? "ACTIVE" : "PAUSED";
        if (statusFilter !== active) {
          return false;
        }
      }
      if (frequencyFilter !== "ALL" && row.frequency !== frequencyFilter) {
        return false;
      }
      if (serviceFilter !== "ALL" && row.serviceType !== serviceFilter) {
        return false;
      }
      if (techFilter !== "ALL" && row.technicianName !== techFilter) {
        return false;
      }
      if (query) {
        const haystack = `${row.name} ${row.propertyAddress} ${row.technicianName}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, statusFilter, frequencyFilter, serviceFilter, techFilter, search]);

  return (
    <div className="ui-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {t("admin.customers.plans.title")}
          </h2>
          <p className="text-xs text-slate-500">
            {t("admin.customers.plans.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="app-chip px-3 py-1 text-xs" data-tone="info">
            {t("admin.customers.plans.results", { count: filtered.length })}
          </span>
          {actionTargetId ? (
            <label
              htmlFor={actionTargetId}
              className="app-button-primary cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              {t("admin.customers.plans.actions.new")}
            </label>
          ) : null}
        </div>
      </div>

      <div className="ui-filter-bar mt-4 flex flex-wrap items-center gap-2 px-3 py-3">
        <label className="ui-search flex flex-1 items-center gap-2 px-3 py-2 text-xs">
          <span className="ui-search-icon">{t("common.actions.search")}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.customers.plans.placeholders.search")}
            className="ui-search-input w-full"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="ui-select px-3 py-2 text-xs"
        >
          <option value="ALL">{t("admin.customers.plans.filters.status")}</option>
          <option value="ACTIVE">{t("common.status.active")}</option>
          <option value="PAUSED">{t("admin.customers.plans.status.paused")}</option>
        </select>
        <select
          value={frequencyFilter}
          onChange={(event) => setFrequencyFilter(event.target.value)}
          className="ui-select px-3 py-2 text-xs"
        >
          <option value="ALL">{t("admin.customers.plans.filters.frequency")}</option>
          <option value="WEEKLY">{t("plans.frequency.weekly")}</option>
          <option value="BIWEEKLY">{t("plans.frequency.biweekly")}</option>
          <option value="MONTHLY">{t("plans.frequency.monthly")}</option>
        </select>
        <select
          value={serviceFilter}
          onChange={(event) => setServiceFilter(event.target.value)}
          className="ui-select px-3 py-2 text-xs"
        >
          <option value="ALL">{t("admin.customers.plans.filters.service")}</option>
          {serviceTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.labelKey ? t(option.labelKey) : option.label}
            </option>
          ))}
        </select>
        <select
          value={techFilter}
          onChange={(event) => setTechFilter(event.target.value)}
          className="ui-select px-3 py-2 text-xs"
        >
          <option value="ALL">
            {t("admin.customers.plans.filters.technician")}
          </option>
          {technicianOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[900px] w-full text-left text-xs text-slate-600">
          <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            <tr className="border-b border-slate-100">
              <th className="pb-3">{t("admin.customers.plans.table.plan")}</th>
              <th className="pb-3">{t("admin.customers.plans.table.property")}</th>
              <th className="pb-3">{t("admin.customers.plans.table.frequency")}</th>
              <th className="pb-3">{t("admin.customers.plans.table.next")}</th>
              <th className="pb-3">{t("admin.customers.plans.table.technician")}</th>
              <th className="pb-3">{t("admin.customers.plans.table.priority")}</th>
              <th className="pb-3">{t("admin.customers.plans.table.status")}</th>
              <th className="pb-3 text-right">{t("admin.customers.plans.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-sm text-slate-500">
                  {t("admin.customers.plans.empty")}
                </td>
              </tr>
            ) : (
              filtered.map((plan) => {
                const nextDate = toDateInput(plan.nextRunAt);
                const nextTime =
                  plan.preferredTime || formatTime(plan.nextRunAt, locale);
                return (
                  <tr key={plan.id} className="border-b border-slate-100">
                    <td className="py-3">
                      <p className="font-semibold text-slate-900">{plan.name}</p>
                      {plan.serviceTierName ? (
                        <p className="text-[11px] text-slate-500">
                          {plan.serviceTierName}
                        </p>
                      ) : null}
                      {plan.notes ? (
                        <p className="text-[11px] text-slate-400">{plan.notes}</p>
                      ) : null}
                    </td>
                    <td className="py-3 text-[11px] text-slate-500">
                      {plan.propertyAddress}
                    </td>
                    <td className="py-3 text-[11px] text-slate-500">
                      {frequencyLabel(plan.frequency)}
                    </td>
                    <td className="py-3 text-[11px] text-slate-500">
                      {formatDate(plan.nextRunAt, locale)} · {nextTime}
                    </td>
                    <td className="py-3 text-[11px] text-slate-500">
                      {plan.technicianName || t("admin.customers.plans.noTech")}
                    </td>
                    <td className="py-3 text-[11px] text-slate-500">
                      {plan.priority === "URGENT"
                        ? t("jobs.priority.urgent")
                        : t("jobs.priority.normal")}
                    </td>
                    <td className="py-3">
                      <span
                        className="app-chip px-3 py-1 text-[11px] font-semibold"
                        data-tone={plan.isActive ? "success" : "warning"}
                      >
                        {plan.isActive
                          ? t("common.status.active")
                          : t("admin.customers.plans.status.paused")}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <form
                          action={onCreateJob}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="planId" value={plan.id} />
                          <input
                            name="scheduledDate"
                            type="date"
                            defaultValue={nextDate}
                            className="ui-mini-input px-2 py-1 text-[11px]"
                          />
                          <input
                            name="scheduledTime"
                            type="time"
                            defaultValue={nextTime}
                            className="ui-mini-input px-2 py-1 text-[11px]"
                          />
                          <button className="ui-button px-3 py-1 text-[11px] font-semibold">
                            {t("admin.customers.plans.actions.createJob")}
                          </button>
                        </form>
                        <form action={onToggle}>
                          <input type="hidden" name="planId" value={plan.id} />
                          <input
                            type="hidden"
                            name="customerId"
                            value={plan.customerId}
                          />
                          <input
                            type="hidden"
                            name="isActive"
                            value={plan.isActive ? "false" : "true"}
                          />
                          <button className="ui-button-ghost px-3 py-1 text-[11px] font-semibold">
                            {plan.isActive
                              ? t("admin.customers.plans.actions.pause")
                              : t("admin.customers.plans.actions.activate")}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
