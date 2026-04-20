"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n/client";
import RoutesSectionTabs from "@/components/routes/RoutesSectionTabs";
import { getGlobalRecurringPlan } from "@/lib/jobs/recurring-plan-templates";
import { parseDateOnly, toDateKey } from "@/lib/jobs/capacity";

type AssistantTechnician = {
  id: string;
  name: string;
};

type AssistantStop = {
  jobId: string;
  customerName: string;
  address: string;
  planName: string | null;
  routeGroupId: string | null;
  routeGroupLabel: string | null;
  technicianId: string;
  technicianName: string;
  order: number;
  scheduledTime: string;
  estimatedArrivalTime: string;
  estimatedDriveMinutesFromPrevious: number;
  estimatedServiceMinutes: number;
  distanceMilesFromPrevious: number | null;
  delayMinutes: number | null;
  driveSource?: "LIVE_TRAFFIC" | "ESTIMATED" | "SAME_ADDRESS";
};

type AssistantRoute = {
  technicianId: string;
  technicianName: string;
  originAddress: string;
  routeGroupIds: string[];
  routeGroupLabels: string[];
  stops: AssistantStop[];
  totalDriveMinutes: number;
  returnDriveMinutes: number;
  totalServiceMinutes: number;
  totalRouteMinutes: number;
  returnDistanceMiles: number | null;
  returnDriveSource?: "LIVE_TRAFFIC" | "ESTIMATED" | "SAME_ADDRESS";
  estimatedReturnTime: string | null;
  conflicts: number;
};

type AssistantPlan = {
  strategy: "BALANCED" | "SHORT_DRIVE" | "KEEP_ASSIGNMENTS";
  routes: AssistantRoute[];
  summary: {
    totalStops: number;
    totalDriveMinutes: number;
    totalServiceMinutes: number;
    totalRouteMinutes: number;
    conflicts: number;
    loadSpread: number;
  };
  updates: Array<{
    jobId: string;
    technicianId: string;
    sortOrder: number;
  }>;
};

type AssistantPlanOption = {
  value: string;
  label: string;
};

type AssistantResponse = {
  date: string;
  originAddress: string;
  technicians: AssistantTechnician[];
  jobsCount: number;
  unresolvedGeocodes: number;
  plans: AssistantPlan[];
};

type RouteAssistantProps = {
  initialDate: string;
  initialPlanTemplate: string | null;
  planOptions: AssistantPlanOption[];
  technicians: AssistantTechnician[];
  originAddress: string;
};

function formatMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function alignDateToSelectedPlan(dateKey: string, planTemplate: string) {
  const selectedPlan = getGlobalRecurringPlan(planTemplate);
  if (!selectedPlan) return dateKey;
  const currentDate = parseDateOnly(dateKey);
  if (!currentDate) return dateKey;
  const currentWeekday = currentDate.getUTCDay();
  const daysToAdd = (selectedPlan.weekday - currentWeekday + 7) % 7;
  const nextDate = new Date(currentDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
  return toDateKey(nextDate);
}

export default function RouteAssistant({
  initialDate,
  initialPlanTemplate,
  planOptions,
  technicians,
  originAddress,
}: RouteAssistantProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [selectedPlanTemplate, setSelectedPlanTemplate] = useState(initialPlanTemplate ?? "");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<AssistantPlan["strategy"] | null>(null);
  const [confirming, setConfirming] = useState(false);

  const selectedPlan = useMemo(
    () => response?.plans.find((plan) => plan.strategy === selectedStrategy) ?? null,
    [response, selectedStrategy]
  );

  const handlePlanTemplateChange = (value: string) => {
    setSelectedPlanTemplate(value);
    if (!value) return;
    setDate((currentDate) => alignDateToSelectedPlan(currentDate, value));
  };

  const requestPlans = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setConfirming(false);
    try {
      const res = await fetch("/api/admin/routes/assistant/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          planTemplate: selectedPlanTemplate || null,
          addressQuery,
          technicianIds: selectedTechnicianId ? [selectedTechnicianId] : [],
        }),
      });
      const data = (await res.json().catch(() => null)) as AssistantResponse | { error?: string } | null;
      if (!res.ok) {
        throw new Error(
          data && "error" in data && typeof data.error === "string"
            ? data.error
            : t("admin.routes.assistant.messages.failed")
        );
      }
      if (!data || !("plans" in data) || !Array.isArray(data.plans)) {
        throw new Error(t("admin.routes.assistant.messages.failed"));
      }
      const safeData = data as AssistantResponse;
      setResponse(safeData);
      setSelectedStrategy(safeData.plans[0]?.strategy ?? null);
      if (safeData.plans.length === 0) {
        setSuccessMessage(t("admin.routes.assistant.messages.empty"));
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("admin.routes.assistant.messages.failed")
      );
    } finally {
      setLoading(false);
    }
  };

  const applySelectedPlan = async () => {
    if (!selectedPlan) return;
    setApplying(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/routes/bulk-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: selectedPlan.updates }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || t("admin.routes.assistant.messages.applyFailed"));
      }
      const firstJob = selectedPlan.updates[0]?.jobId ?? "";
      const month = date.slice(0, 7);
      router.push(`/admin/routes${firstJob ? `?month=${month}&highlight=${encodeURIComponent(firstJob)}` : `?month=${month}`}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("admin.routes.assistant.messages.applyFailed")
      );
      setApplying(false);
      setConfirming(false);
    }
  };

  // ─── Confirmation screen ───────────────────────────────────────────────────
  if (confirming && selectedPlan) {
    return (
      <div className="space-y-4">
        <section className="rounded-3xl border border-slate-900 bg-slate-900 p-5 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {t("admin.routes.assistant.kicker")}
          </p>
          <h2 className="mt-3 text-xl font-semibold text-white">
            {t("admin.routes.assistant.confirm.title")}
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            {t("admin.routes.assistant.confirm.body", { count: selectedPlan.updates.length })}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-600 px-3 py-1 text-slate-300">
              {t(`admin.routes.assistant.strategies.${selectedPlan.strategy}.name`)}
            </span>
            <span className="rounded-full border border-slate-600 px-3 py-1 text-slate-300">
              {t("admin.routes.assistant.summary.stops", { count: selectedPlan.summary.totalStops })}
            </span>
            <span className="rounded-full border border-slate-600 px-3 py-1 text-slate-300">
              {t("admin.routes.assistant.summary.drive", { value: formatMinutes(selectedPlan.summary.totalDriveMinutes) })}
            </span>
            <span className="rounded-full border border-slate-600 px-3 py-1 text-slate-300">
              {t("admin.routes.assistant.summary.service", { value: formatMinutes(selectedPlan.summary.totalServiceMinutes) })}
            </span>
            {selectedPlan.summary.conflicts > 0 ? (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-1 font-semibold text-amber-300">
                {t("admin.routes.assistant.summary.conflicts", { count: selectedPlan.summary.conflicts })}
              </span>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={applySelectedPlan}
              disabled={applying}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
            >
              {applying
                ? t("admin.routes.assistant.actions.applying")
                : t("admin.routes.assistant.confirm.apply", { count: selectedPlan.updates.length })}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={applying}
              className="rounded-full border border-slate-600 px-6 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-400 hover:text-white disabled:opacity-60"
            >
              {t("admin.routes.assistant.confirm.cancel")}
            </button>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  // ─── Main view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Controls panel */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {t("admin.routes.assistant.kicker")}
          </p>
          <RoutesSectionTabs />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          {t("admin.routes.assistant.title")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("admin.routes.assistant.subtitle")}
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            {/* Origin address — always visible */}
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800">
                {t("admin.routes.assistant.fields.origin")}
              </p>
              <p className="mt-1 text-sm font-semibold text-cyan-950">
                {response?.originAddress ?? originAddress}
              </p>
              <p className="mt-0.5 text-xs text-cyan-700">
                {t("admin.routes.assistant.originHint")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.routes.assistant.fields.date")}
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.routes.assistant.fields.plan")}
                <select
                  value={selectedPlanTemplate}
                  onChange={(event) => handlePlanTemplateChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="">{t("admin.routes.assistant.placeholders.plan")}</option>
                  {planOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.routes.assistant.fields.technician")}
                <select
                  value={selectedTechnicianId}
                  onChange={(event) => setSelectedTechnicianId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="">{t("admin.routes.assistant.placeholders.technician")}</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.routes.assistant.fields.addressFilter")}
                <input
                  type="text"
                  value={addressQuery}
                  onChange={(event) => setAddressQuery(event.target.value)}
                  placeholder={t("admin.routes.assistant.placeholders.addressFilter")}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.routes.assistant.rules.title")}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                <li>{t("admin.routes.assistant.rules.bookingWindows")}</li>
                <li>{t("admin.routes.assistant.rules.weekendPolicy")}</li>
                <li>{t("admin.routes.assistant.rules.noReschedule")}</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={requestPlans}
              disabled={loading || !date}
              className="w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? t("admin.routes.assistant.actions.generating")
                : t("admin.routes.assistant.actions.generate")}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}
      </section>

      {/* Results panel */}
      {response ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {/* Metric cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.routes.assistant.metrics.jobs")}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{response.jobsCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.routes.assistant.metrics.technicians")}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{response.technicians.length}</p>
            </div>
            <div
              className={`rounded-2xl border px-4 py-3 ${
                response.unresolvedGeocodes > 0
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200 bg-slate-50/70"
              }`}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  response.unresolvedGeocodes > 0 ? "text-amber-700" : "text-slate-500"
                }`}
              >
                {t("admin.routes.assistant.metrics.unresolved")}
              </p>
              <p
                className={`mt-1 text-xl font-semibold ${
                  response.unresolvedGeocodes > 0 ? "text-amber-900" : "text-slate-900"
                }`}
              >
                {response.unresolvedGeocodes}
              </p>
              {response.unresolvedGeocodes > 0 ? (
                <p className="mt-0.5 text-[10px] text-amber-700">
                  {t("admin.routes.assistant.metrics.geocodeWarning", {
                    count: response.unresolvedGeocodes,
                  })}
                </p>
              ) : null}
            </div>
          </div>

          {response.plans.length > 0 ? (
            <>
              {/* Strategy cards */}
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {response.plans.map((plan) => {
                  const selected = selectedStrategy === plan.strategy;
                  return (
                    <button
                      type="button"
                      key={plan.strategy}
                      onClick={() => setSelectedStrategy(plan.strategy)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                        {t(`admin.routes.assistant.strategies.${plan.strategy}.name`)}
                      </p>
                      <p className={`mt-1 text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>
                        {t(`admin.routes.assistant.strategies.${plan.strategy}.hint`)}
                      </p>
                      <div className="mt-3 space-y-1">
                        <p className={`text-sm font-semibold ${selected ? "text-white" : "text-slate-900"}`}>
                          {t("admin.routes.assistant.summary.drive", {
                            value: formatMinutes(plan.summary.totalDriveMinutes),
                          })}
                        </p>
                        <p className={`text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>
                          {t("admin.routes.assistant.summary.service", {
                            value: formatMinutes(plan.summary.totalServiceMinutes),
                          })}
                        </p>
                        <p className={`text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>
                          {t("admin.routes.assistant.summary.loadSpread", {
                            value: plan.summary.loadSpread,
                          })}
                        </p>
                        {plan.summary.conflicts > 0 ? (
                          <p className={`text-xs font-semibold ${selected ? "text-amber-300" : "text-amber-600"}`}>
                            {t("admin.routes.assistant.summary.conflicts", {
                              count: plan.summary.conflicts,
                            })}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected plan detail */}
              {selectedPlan ? (
                <div className="mt-5 space-y-4">
                  {/* Summary chips */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        {t("admin.routes.assistant.summary.stops", {
                          count: selectedPlan.summary.totalStops,
                        })}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        {t("admin.routes.assistant.summary.drive", {
                          value: formatMinutes(selectedPlan.summary.totalDriveMinutes),
                        })}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        {t("admin.routes.assistant.summary.service", {
                          value: formatMinutes(selectedPlan.summary.totalServiceMinutes),
                        })}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        {t("admin.routes.assistant.summary.loadSpread", {
                          value: selectedPlan.summary.loadSpread,
                        })}
                      </span>
                      {selectedPlan.summary.conflicts > 0 ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                          {t("admin.routes.assistant.summary.conflicts", {
                            count: selectedPlan.summary.conflicts,
                          })}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                        {t("admin.routes.assistant.summary.livePairs", {
                          count: selectedPlan.routes
                            .flatMap((r) => r.stops)
                            .filter((s) => s.driveSource === "LIVE_TRAFFIC").length,
                        })}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        {t("admin.routes.assistant.summary.estimatedPairs", {
                          count: selectedPlan.routes
                            .flatMap((r) => r.stops)
                            .filter((s) => s.driveSource === "ESTIMATED").length,
                        })}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {t("admin.routes.assistant.actions.apply")}
                    </button>
                  </div>

                  {/* Per-technician route cards */}
                  <div className="space-y-3">
                    {selectedPlan.routes.map((route) => (
                      <div
                        key={route.technicianId}
                        className="overflow-hidden rounded-2xl border border-slate-200"
                      >
                        {/* Route header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {route.technicianName}
                            </p>
                            {route.routeGroupLabels.length > 0 ? (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {route.routeGroupLabels.join(" | ")}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>
                              {t("admin.routes.assistant.summary.stops", {
                                count: route.stops.length,
                              })}
                            </span>
                            <span>
                              {t("admin.routes.assistant.summary.drive", {
                                value: formatMinutes(route.totalDriveMinutes),
                              })}
                            </span>
                            <span>
                              {t("admin.routes.assistant.summary.service", {
                                value: formatMinutes(route.totalServiceMinutes),
                              })}
                            </span>
                            <span>
                              {t("admin.routes.assistant.summary.return", {
                                value: formatMinutes(route.returnDriveMinutes),
                              })}
                            </span>
                            {route.conflicts > 0 ? (
                              <span className="font-semibold text-amber-600">
                                {t("admin.routes.assistant.summary.conflicts", {
                                  count: route.conflicts,
                                })}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Route flow bar */}
                        <div className="border-b border-slate-200 bg-cyan-50/70 px-4 py-2 text-xs text-cyan-900">
                          {t("admin.routes.assistant.summary.routeFlow", {
                            origin: route.originAddress,
                            eta: route.estimatedReturnTime ?? "--:--",
                            drive: `${formatMinutes(route.returnDriveMinutes)}${
                              route.returnDistanceMiles != null
                                ? ` (${route.returnDistanceMiles} mi)`
                                : ""
                            }`,
                          })}
                        </div>

                        {/* Stops table */}
                        <div className="customers-table-scroll overflow-x-auto">
                          <table className="customers-table min-w-[1160px] w-full text-xs text-slate-600">
                            <thead>
                              <tr className="border-b border-slate-200 bg-white text-[11px] uppercase tracking-[0.1em] text-slate-500">
                                <th className="px-3 py-2 text-left">#</th>
                                <th className="px-3 py-2 text-left">
                                  {t("admin.routes.assistant.table.customer")}
                                </th>
                                <th className="px-3 py-2 text-left">
                                  {t("admin.routes.assistant.table.plan")}
                                </th>
                                <th className="px-3 py-2 text-left">
                                  {t("admin.routes.assistant.table.address")}
                                </th>
                                <th className="px-3 py-2 text-left">
                                  {t("admin.routes.assistant.table.drive")}
                                </th>
                                <th className="px-3 py-2 text-left">
                                  {t("admin.routes.assistant.table.service")}
                                </th>
                                <th className="px-3 py-2 text-left">
                                  {t("admin.routes.assistant.table.eta")}
                                </th>
                                <th className="px-3 py-2 text-left">
                                  {t("admin.routes.assistant.table.scheduled")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {route.stops.map((stop) => {
                                const hasConflict =
                                  stop.delayMinutes != null && stop.delayMinutes > 0;
                                return (
                                  <tr
                                    key={stop.jobId}
                                    className={`border-b border-slate-100 last:border-b-0 transition ${
                                      hasConflict ? "bg-amber-50/60" : "bg-white hover:bg-sky-50/30"
                                    }`}
                                  >
                                    <td className="px-3 py-2 font-semibold text-slate-700">
                                      {stop.order}
                                    </td>
                                    <td className="px-3 py-2">
                                      <Link
                                        href={`/admin/routes/${stop.jobId}`}
                                        className="font-medium text-sky-700 hover:underline"
                                      >
                                        {stop.customerName}
                                      </Link>
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                      <p className="font-medium text-slate-700">
                                        {stop.planName ??
                                          t("admin.routes.assistant.table.noPlan")}
                                      </p>
                                      {stop.routeGroupLabel ? (
                                        <p className="text-[10px] text-cyan-700">
                                          {stop.routeGroupLabel}
                                        </p>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">{stop.address}</td>
                                    <td className="px-3 py-2 text-slate-600">
                                      {stop.order === 1
                                        ? t("admin.routes.assistant.table.fromBase", {
                                            value: `${stop.estimatedDriveMinutesFromPrevious}m${
                                              stop.distanceMilesFromPrevious != null
                                                ? ` (${stop.distanceMilesFromPrevious} mi)`
                                                : ""
                                            }`,
                                          })
                                        : `${stop.estimatedDriveMinutesFromPrevious}m${
                                            stop.distanceMilesFromPrevious != null
                                              ? ` (${stop.distanceMilesFromPrevious} mi)`
                                              : ""
                                          }`}
                                      {stop.order > 1 ? (
                                        <span
                                          className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                            stop.driveSource === "LIVE_TRAFFIC"
                                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                              : stop.driveSource === "SAME_ADDRESS"
                                                ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                                                : "border-slate-200 bg-slate-50 text-slate-600"
                                          }`}
                                        >
                                          {stop.driveSource === "LIVE_TRAFFIC"
                                            ? t("admin.routes.assistant.table.liveTraffic")
                                            : stop.driveSource === "SAME_ADDRESS"
                                              ? t("admin.routes.assistant.table.sameAddress")
                                              : t("admin.routes.assistant.table.estimated")}
                                        </span>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                      {formatMinutes(stop.estimatedServiceMinutes)}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                      {stop.estimatedArrivalTime}
                                      {stop.delayMinutes != null ? (
                                        <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                          +{stop.delayMinutes}m
                                        </span>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                      {stop.scheduledTime}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
