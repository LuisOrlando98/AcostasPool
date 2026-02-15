"use client";

import AppShell from "@/components/layout/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";

type PropertyOption = {
  id: string;
  address: string;
};

type AvailabilityDay = {
  date: string;
  totalCapacity: number;
  usedCapacity: number;
  remainingCapacity: number;
  slots: Array<{
    value: string;
    remaining: number;
  }>;
};

type AvailabilityResponse = {
  leadDays: number;
  availability: AvailabilityDay[];
};

export default function ClientRequestPage() {
  const { t } = useI18n();
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [mode, setMode] = useState<"SINGLE" | "RECURRING">("SINGLE");
  const [weeks, setWeeks] = useState(7);
  const [visitsPerWeek, setVisitsPerWeek] = useState<1 | 2>(1);
  const [urgentOverride, setUrgentOverride] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [leadDays, setLeadDays] = useState(2);
  const serviceOptions = useMemo(
    () => [
      t("client.request.reasons.emergency"),
      t("client.request.reasons.quickCleaning"),
      t("client.request.reasons.chemBalance"),
      t("client.request.reasons.general"),
    ],
    [t]
  );
  const [reason, setReason] = useState(serviceOptions[0]);
  const [propertyId, setPropertyId] = useState("");
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success" | "warning">(
    "success"
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [propertiesRes, availabilityRes] = await Promise.all([
        fetch("/api/client/properties"),
        fetch("/api/client/availability?days=84"),
      ]);

      const propertiesData = (await propertiesRes
        .json()
        .catch(() => ({ properties: [] }))) as { properties: PropertyOption[] };

      if (!cancelled) {
        setProperties(propertiesData.properties);
        if (propertiesData.properties.length > 0) {
          setPropertyId(propertiesData.properties[0].id);
        }
      }

      const availabilityData = (await availabilityRes
        .json()
        .catch(() => ({ leadDays: 2, availability: [] }))) as AvailabilityResponse;

      if (!cancelled) {
        setLeadDays(availabilityData.leadDays ?? 2);
        const nextAvailability = Array.isArray(availabilityData.availability)
          ? availabilityData.availability
          : [];
        setAvailability(nextAvailability);
        if (nextAvailability.length > 0) {
          const firstDay = nextAvailability[0];
          setPreferredDate(firstDay.date);
          setPreferredTime(firstDay.slots[0]?.value ?? "");
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDay = useMemo(
    () => availability.find((day) => day.date === preferredDate) ?? null,
    [availability, preferredDate]
  );
  const resolvedReason = serviceOptions.includes(reason)
    ? reason
    : serviceOptions[0];
  const resolvedPreferredTime =
    !urgentOverride && selectedDay
      ? selectedDay.slots.some((slot) => slot.value === preferredTime)
        ? preferredTime
        : selectedDay.slots[0]?.value ?? ""
      : preferredTime;

  const formatAvailabilityDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSubmit = async () => {
    if (!propertyId) {
      setMessageTone("error");
      setMessage(t("client.request.errors.property"));
      return;
    }

    if (!preferredDate || !resolvedPreferredTime) {
      setMessageTone("error");
      setMessage(t("client.request.errors.availability"));
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/client/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        reason: resolvedReason,
        preferredDate,
        preferredTime: resolvedPreferredTime,
        description,
        mode,
        weeks,
        visitsPerWeek,
        urgentOverride,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      reviewRequired?: boolean;
      partial?: boolean;
      createdCount?: number;
    };

    if (!res.ok) {
      setMessageTone("error");
      setMessage(data.error ?? t("client.request.errors.submit"));
      setLoading(false);
      return;
    }

    if (data.reviewRequired) {
      setMessageTone("warning");
      setMessage(t("client.request.successReview"));
    } else if (data.partial) {
      setMessageTone("warning");
      setMessage(
        t("client.request.successPartial", {
          count: String(data.createdCount ?? 0),
        })
      );
    } else {
      setMessageTone("success");
      setMessage(
        t("client.request.successCount", {
          count: String(data.createdCount ?? 1),
        })
      );
    }

    setLoading(false);
  };

  const messageClass =
    messageTone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : messageTone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <AppShell
      title={t("client.request.title")}
      subtitle={t("client.request.subtitle")}
      role="CUSTOMER"
    >
      <section className="app-card p-6 shadow-contrast">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("client.request.formTitle")}</h2>
            <p className="text-sm text-slate-500">{t("client.request.formSubtitle")}</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
            {t("client.request.leadTime", { days: String(leadDays) })}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("client.request.fields.property")}
            </label>
            <select
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              className="app-input mt-2 w-full bg-white px-4 py-3 text-sm text-slate-700"
            >
              {properties.length === 0 ? (
                <option value="">{t("client.request.fields.noProperty")}</option>
              ) : (
                properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.address}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("client.request.fields.mode")}
            </label>
            <select
              value={mode}
              onChange={(event) =>
                setMode(event.target.value === "RECURRING" ? "RECURRING" : "SINGLE")
              }
              className="app-input mt-2 w-full bg-white px-4 py-3 text-sm text-slate-700"
            >
              <option value="SINGLE">{t("client.request.modes.single")}</option>
              <option value="RECURRING">{t("client.request.modes.recurring")}</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("client.request.fields.visitsPerWeek")}
            </label>
            <select
              value={visitsPerWeek}
              onChange={(event) => setVisitsPerWeek(event.target.value === "2" ? 2 : 1)}
              disabled={mode !== "RECURRING"}
              className="app-input mt-2 w-full bg-white px-4 py-3 text-sm text-slate-700 disabled:opacity-60"
            >
              <option value={1}>{t("client.request.options.oncePerWeek")}</option>
              <option value={2}>{t("client.request.options.twicePerWeek")}</option>
            </select>
          </div>

          {mode === "RECURRING" ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("client.request.fields.weeks")}
              </label>
              <select
                value={weeks}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setWeeks(Number.isFinite(next) ? next : 7);
                }}
                className="app-input mt-2 w-full bg-white px-4 py-3 text-sm text-slate-700"
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {t("client.request.options.weeksCount", { count: String(value) })}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("client.request.fields.reason")}
            </label>
            <select
              value={resolvedReason}
              onChange={(event) => setReason(event.target.value)}
              className="app-input mt-2 w-full bg-white px-4 py-3 text-sm text-slate-700"
            >
              {serviceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <input
              type="checkbox"
              checked={urgentOverride}
              onChange={(event) => setUrgentOverride(event.target.checked)}
              className="h-4 w-4"
            />
            <span>{t("client.request.fields.urgentOverride")}</span>
          </label>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {urgentOverride
                ? t("client.request.fields.preferredDate")
                : t("client.request.fields.availableDate")}
            </label>
            {urgentOverride ? (
              <input
                type="date"
                value={preferredDate}
                onChange={(event) => setPreferredDate(event.target.value)}
                className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
              />
            ) : (
              <select
                value={preferredDate}
                onChange={(event) => setPreferredDate(event.target.value)}
                className="app-input mt-2 w-full bg-white px-4 py-3 text-sm text-slate-700"
              >
                {availability.length === 0 ? (
                  <option value="">{t("client.request.fields.noAvailability")}</option>
                ) : (
                  availability.map((day) => (
                    <option key={day.date} value={day.date}>
                      {t("client.request.options.dayCapacity", {
                        date: formatAvailabilityDate(day.date),
                        count: String(day.remainingCapacity),
                      })}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {urgentOverride
                ? t("client.request.fields.preferredTime")
                : t("client.request.fields.availableTime")}
            </label>
            {urgentOverride ? (
              <input
                type="time"
                value={preferredTime}
                onChange={(event) => setPreferredTime(event.target.value)}
                className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
              />
            ) : (
              <select
                value={resolvedPreferredTime}
                onChange={(event) => setPreferredTime(event.target.value)}
                className="app-input mt-2 w-full bg-white px-4 py-3 text-sm text-slate-700"
              >
                {selectedDay?.slots.length ? (
                  selectedDay.slots.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {t("client.request.options.timeCapacity", {
                        time: slot.value,
                        count: String(slot.remaining),
                      })}
                    </option>
                  ))
                ) : (
                  <option value="">{t("client.request.fields.noAvailability")}</option>
                )}
              </select>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("client.request.fields.description")}
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="app-input mt-2 min-h-[120px] w-full px-4 py-3 text-sm text-slate-700"
              placeholder={t("client.request.placeholders.description")}
            />
          </div>

          {message ? (
            <div className={`md:col-span-2 rounded-xl border px-4 py-3 text-sm ${messageClass}`}>
              {message}
            </div>
          ) : null}

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {urgentOverride ? t("client.request.noticeUrgent") : t("client.request.notice")}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="app-button-primary px-5 py-2 text-sm font-semibold disabled:opacity-70"
            >
              {loading ? t("client.request.loading") : t("client.request.submit")}
            </button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
