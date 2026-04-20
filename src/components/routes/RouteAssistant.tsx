"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  autoOptimizeEnabled: boolean;
  planOptions: AssistantPlanOption[];
  technicians: AssistantTechnician[];
};

function formatMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) {
    return `${mins}m`;
  }
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function alignDateToSelectedPlan(dateKey: string, planTemplate: string) {
  const selectedPlan = getGlobalRecurringPlan(planTemplate);
  if (!selectedPlan) {
    return dateKey;
  }

  const currentDate = parseDateOnly(dateKey);
  if (!currentDate) {
    return dateKey;
  }

  const currentWeekday = currentDate.getUTCDay();
  const daysToAdd = (selectedPlan.weekday - currentWeekday + 7) % 7;
  const nextDate = new Date(currentDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
  return toDateKey(nextDate);
}

export default function RouteAssistant({
  initialDate,
  initialPlanTemplate,
  autoOptimizeEnabled,
  planOptions,
  technicians,
}: RouteAssistantProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [selectedPlanTemplate, setSelectedPlanTemplate] = useState(
    initialPlanTemplate ?? ""
  );
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [autoOptimizeEnabledState, setAutoOptimizeEnabledState] =
    useState(autoOptimizeEnabled);
  const [selectedStrategy, setSelectedStrategy] = useState<
    AssistantPlan["strategy"] | null
  >(null);

  const selectedPlan = useMemo(
    () =>
      response?.plans.find((plan) => plan.strategy === selectedStrategy) ?? null,
    [response, selectedStrategy]
  );

  const handlePlanTemplateChange = (value: string) => {
    setSelectedPlanTemplate(value);
    if (!value) {
      return;
    }
    setDate((currentDate) => alignDateToSelectedPlan(currentDate, value));
  };

  const requestPlans = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = {
        date,
        planTemplate: selectedPlanTemplate || null,
        addressQuery,
        technicianIds: selectedTechnicianId ? [selectedTechnicianId] : [],
      };
      const res = await fetch("/api/admin/routes/assistant/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as AssistantResponse | {
        error?: string;
      } | null;
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
      const message =
        error instanceof Error
          ? error.message
          : t("admin.routes.assistant.messages.failed");
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSavingPreferences(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/admin/routes/assistant/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyAutoOptimizeEnabled: autoOptimizeEnabledState,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(
          data?.error || t("admin.routes.assistant.messages.preferencesFailed")
        );
      }
      setSuccessMessage(t("admin.routes.assistant.messages.preferencesSaved"));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("admin.routes.assistant.messages.preferencesFailed");
      setErrorMessage(message);
    } finally {
      setSavingPreferences(false);
    }
  };

  const applySelectedPlan = async () => {
    if (!selectedPlan) {
      return;
    }
    setApplying(true);
    setErrorMessage(null);
    setSuccessMessage(null);
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
      const search = firstJob
        ? `?month=${month}&highlight=${encodeURIComponent(firstJob)}`
        : `?month=${month}`;
      router.push(`/admin/routes${search}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("admin.routes.assistant.messages.applyFailed");
      setErrorMessage(message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {t("admin.routes.assistant.kicker")}
          </p>
          <RoutesSectionTabs />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              {t("admin.routes.assistant.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("admin.routes.assistant.subtitle")}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
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
                  {planOptions.map((planOption) => (
                    <option key={planOption.value} value={planOption.value}>
                      {planOption.label}
                    </option>
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
                  <option value="">
                    {t("admin.routes.assistant.placeholders.technician")}
                  </option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.name}
                    </option>
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
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800">
                {t("admin.routes.assistant.fields.origin")}
              </p>
              <p className="mt-1 text-sm font-medium text-cyan-950">
                {response?.originAddress ?? "10731 SW 147th Ct, Miami, FL 33196"}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
                    {t("admin.routes.assistant.automation.title")}
                  </p>
                  <p className="mt-1 text-sm text-emerald-950">
                    {t("admin.routes.assistant.automation.subtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={savePreferences}
                  disabled={savingPreferences}
                  className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPreferences
                    ? t("admin.routes.assistant.actions.savingPreferences")
                    : t("admin.routes.assistant.actions.savePreferences")}
                </button>
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={autoOptimizeEnabledState}
                  onChange={(event) =>
                    setAutoOptimizeEnabledState(event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>{t("admin.routes.assistant.automation.checkmark")}</span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t("admin.routes.assistant.rules.title")}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>{t("admin.routes.assistant.rules.bookingWindows")}</li>
              <li>{t("admin.routes.assistant.rules.weekendPolicy")}</li>
              <li>{t("admin.routes.assistant.rules.noReschedule")}</li>
            </ul>
            <button
              type="button"
              onClick={requestPlans}
              disabled={
                loading || !date || !selectedPlanTemplate || !selectedTechnicianId
              }
              className="mt-4 w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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

      {response ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {response.technicians.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.routes.assistant.metrics.unresolved")}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {response.unresolvedGeocodes}
              </p>
            </div>
          </div>

          {response.plans.length > 0 ? (
            <>
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
                      <p className={`mt-1 text-xs ${selected ? "text-slate-200" : "text-slate-500"}`}>
                        {t(`admin.routes.assistant.strategies.${plan.strategy}.hint`)}
                      </p>
                      <p className={`mt-3 text-sm font-semibold ${selected ? "text-white" : "text-slate-900"}`}>
                        {t("admin.routes.assistant.summary.drive", {
                          value: formatMinutes(plan.summary.totalDriveMinutes),
                        })}
                      </p>
                    </button>
                  );
                })}
              </div>

              {selectedPlan ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                      {t("admin.routes.assistant.summary.livePairs", {
                        count: selectedPlan.routes
                          .flatMap((route) => route.stops)
                          .filter((stop) => stop.driveSource === "LIVE_TRAFFIC").length,
                      })}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                      {t("admin.routes.assistant.summary.estimatedPairs", {
                        count: selectedPlan.routes
                          .flatMap((route) => route.stops)
                          .filter((stop) => stop.driveSource === "ESTIMATED").length,
                      })}
                    </span>
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1">
                      {t("admin.routes.assistant.summary.sameAddressPairs", {
                        count: selectedPlan.routes
                          .flatMap((route) => route.stops)
                          .filter((stop) => stop.driveSource === "SAME_ADDRESS").length,
                      })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
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
                        {t("admin.routes.assistant.summary.conflicts", {
                          count: selectedPlan.summary.conflicts,
                        })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={applySelectedPlan}
                      disabled={applying}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {applying
                        ? t("admin.routes.assistant.actions.applying")
                        : t("admin.routes.assistant.actions.apply")}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {selectedPlan.routes.map((route) => (
                      <div
                        key={route.technicianId}
                        className="overflow-hidden rounded-2xl border border-slate-200"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {route.technicianName}
                            </p>
                            {route.routeGroupLabels.length > 0 ? (
                              <p className="mt-1 text-xs text-slate-500">
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
                              {t("admin.routes.assistant.summary.return", {
                                value: formatMinutes(route.returnDriveMinutes),
                              })}
                            </span>
                            <span>
                              {t("admin.routes.assistant.summary.service", {
                                value: formatMinutes(route.totalServiceMinutes),
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="border-b border-slate-200 bg-cyan-50/70 px-4 py-2 text-xs text-cyan-900">
                          {t("admin.routes.assistant.summary.routeFlow", {
                            origin: route.originAddress,
                            eta: route.estimatedReturnTime ?? "--:--",
                            drive:
                              `${route.returnDriveMinutes}m${
                                route.returnDistanceMiles != null
                                  ? ` (${route.returnDistanceMiles} mi)`
                                  : ""
                              }`,
                          })}
                        </div>
                        <div className="customers-table-scroll overflow-x-auto">
                          <table className="customers-table min-w-[1060px] w-full text-xs text-slate-600">
                            <thead>
                              <tr className="border-b border-slate-200 bg-white text-slate-500">
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
                                  {t("admin.routes.assistant.table.eta")}
                                </th>
                                <th className="px-3 py-2 text-left">
                                  {t("admin.routes.assistant.table.scheduled")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {route.stops.map((stop) => (
                                <tr key={stop.jobId} className="border-b border-slate-100 last:border-b-0">
                                  <td className="px-3 py-2 font-semibold text-slate-700">
                                    {stop.order}
                                  </td>
                                  <td className="px-3 py-2 text-slate-700">{stop.customerName}</td>
                                  <td className="px-3 py-2 text-slate-600">
                                    <p className="font-medium text-slate-700">
                                      {stop.planName ?? t("admin.routes.assistant.table.noPlan")}
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
                                    {stop.estimatedArrivalTime}
                                    {stop.delayMinutes != null ? (
                                      <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                        +{stop.delayMinutes}m
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">{stop.scheduledTime}</td>
                                </tr>
                              ))}
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
