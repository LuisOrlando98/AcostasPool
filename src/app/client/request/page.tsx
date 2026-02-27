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

function parseDateKey(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, months: number) {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export default function ClientRequestPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === "es" ? "es-US" : "en-US";

  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [mode, setMode] = useState<"SINGLE" | "RECURRING">("SINGLE");
  const [weeks, setWeeks] = useState(7);
  const [visitsPerWeek, setVisitsPerWeek] = useState<1 | 2>(1);
  const [urgentOverride, setUrgentOverride] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [leadDays, setLeadDays] = useState(2);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date())
  );

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
          setPreferredTime(
            firstDay.slots.find((slot) => slot.remaining > 0)?.value ?? ""
          );
          const firstDate = parseDateKey(firstDay.date);
          if (firstDate) {
            setCalendarMonth(startOfMonth(firstDate));
          }
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    for (const day of availability) {
      map.set(day.date, day);
    }
    return map;
  }, [availability]);

  const selectedDay = useMemo(
    () => availabilityByDate.get(preferredDate) ?? null,
    [availabilityByDate, preferredDate]
  );

  const monthBounds = useMemo(() => {
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const day of availability) {
      const parsed = parseDateKey(day.date);
      if (!parsed) {
        continue;
      }
      if (!minDate || parsed < minDate) {
        minDate = parsed;
      }
      if (!maxDate || parsed > maxDate) {
        maxDate = parsed;
      }
    }

    if (!minDate || !maxDate) {
      return null;
    }

    return {
      min: startOfMonth(minDate),
      max: startOfMonth(maxDate),
    };
  }, [availability]);

  const canGoPrevMonth = monthBounds
    ? addMonths(calendarMonth, -1) >= monthBounds.min
    : false;
  const canGoNextMonth = monthBounds
    ? addMonths(calendarMonth, 1) <= monthBounds.max
    : false;

  const weekdayLabels = useMemo(() => {
    const sunday = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + index);
      return day
        .toLocaleDateString(localeTag, { weekday: "short" })
        .replace(".", "")
        .slice(0, 2)
        .toUpperCase();
    });
  }, [localeTag]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0
    );

    const startOffset = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - startOffset);

    const endOffset = 6 - monthEnd.getDay();
    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(monthEnd.getDate() + endOffset);

    const days: Date[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [calendarMonth]);

  const resolvedReason = serviceOptions.includes(reason)
    ? reason
    : serviceOptions[0];

  const resolvedPreferredTime =
    !urgentOverride && selectedDay
      ? selectedDay.slots.some(
          (slot) => slot.value === preferredTime && slot.remaining > 0
        )
        ? preferredTime
        : selectedDay.slots.find((slot) => slot.remaining > 0)?.value ?? ""
      : preferredTime;

  const formatAvailabilityDate = (value: string) => {
    const date = parseDateKey(value);
    if (!date) {
      return value;
    }

    return date.toLocaleDateString(localeTag, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (value: string) => {
    const [hourRaw, minuteRaw] = value.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return value;
    }

    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date.toLocaleTimeString(localeTag, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleSelectDate = (dateKey: string) => {
    const day = availabilityByDate.get(dateKey);
    if (!day || day.remainingCapacity <= 0) {
      return;
    }
    setPreferredDate(dateKey);
    setPreferredTime(day.slots.find((slot) => slot.remaining > 0)?.value ?? "");
    setMessage(null);
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
      <section className="app-card p-4 shadow-contrast sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t("client.request.formTitle")}</h2>
            <p className="text-sm text-slate-500">{t("client.request.formSubtitle")}</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
            {t("client.request.leadTime", { days: String(leadDays) })}
          </span>
        </div>

        <div className="mt-5 grid gap-3.5 md:grid-cols-2">
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

          {urgentOverride ? (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("client.request.fields.preferredDate")}
                </label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    setPreferredDate(nextDate);
                    const parsed = parseDateKey(nextDate);
                    if (parsed) {
                      setCalendarMonth(startOfMonth(parsed));
                    }
                  }}
                  className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("client.request.fields.preferredTime")}
                </label>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={(event) => setPreferredTime(event.target.value)}
                  className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-[linear-gradient(130deg,rgba(241,245,249,0.92),rgba(248,250,252,0.98))] p-3 sm:p-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t("client.request.calendar.stepDate")}
                      </p>
                      <p className="mt-1 break-words pr-2 text-sm font-semibold text-slate-900">
                        {calendarMonth.toLocaleDateString(localeTag, {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                        disabled={!canGoPrevMonth}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={t("client.request.calendar.previousMonth")}
                      >
                        {t("client.request.calendar.prev")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                        disabled={!canGoNextMonth}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={t("client.request.calendar.nextMonth")}
                      >
                        {t("client.request.calendar.next")}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-7 gap-1">
                    {weekdayLabels.map((label) => (
                      <div
                        key={label}
                        className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500"
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {calendarDays.map((date) => {
                      const dateKey = toDateKey(date);
                      const day = availabilityByDate.get(dateKey);
                      const inMonth = isSameMonth(date, calendarMonth);
                      const isAvailable = Boolean(day && day.remainingCapacity > 0);
                      const isSelected = preferredDate === dateKey;
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const showUnavailableMarker = inMonth && !isAvailable;
                      const unavailableStyle = isWeekend
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-300";

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          onClick={() => handleSelectDate(dateKey)}
                          disabled={!isAvailable}
                          className={`relative h-11 overflow-hidden rounded-lg border px-1 py-1 text-center transition sm:h-12 ${
                            !inMonth
                              ? "border-transparent bg-transparent text-slate-300"
                              : !isAvailable
                                ? unavailableStyle
                                : isSelected
                                  ? "border-sky-500 bg-sky-50 text-sky-900 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50/60"
                          }`}
                        >
                          <span className="block text-sm font-semibold leading-none">
                            {date.getDate()}
                          </span>
                          {showUnavailableMarker ? (
                            <>
                              <span className="sr-only">
                                {t("client.request.calendar.unavailableShort")}
                              </span>
                              <span
                                aria-hidden
                                className={`absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${
                                  isWeekend ? "bg-slate-400" : "bg-rose-500"
                                }`}
                              />
                            </>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("client.request.calendar.stepTime")}
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-700">
                    {preferredDate
                      ? formatAvailabilityDate(preferredDate)
                      : t("client.request.calendar.selectDateHint")}
                  </p>

                  {selectedDay?.slots.length ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 min-[460px]:grid-cols-2 xl:grid-cols-1">
                      {selectedDay.slots.map((slot) => {
                        const isSelected = slot.value === resolvedPreferredTime;
                        const isSlotAvailable = slot.remaining > 0;
                        return (
                          <button
                            key={slot.value}
                            type="button"
                            disabled={!isSlotAvailable}
                            onClick={() => setPreferredTime(slot.value)}
                            className={`rounded-xl border px-3 py-2 text-left transition ${
                              !isSlotAvailable
                                ? "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-500"
                                : isSelected
                                ? "border-sky-500 bg-sky-50 text-sky-800"
                                : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50/50"
                            }`}
                          >
                            <span className="block text-sm font-semibold leading-tight">
                              {formatTime(slot.value)}
                            </span>
                            <span
                              className={`block text-[11px] ${
                                isSlotAvailable ? "text-slate-500" : "text-rose-600"
                              }`}
                            >
                              {isSlotAvailable
                                ? t("client.request.calendar.available")
                                : t("client.request.calendar.unavailable")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      {preferredDate
                        ? t("client.request.fields.noAvailability")
                        : t("client.request.calendar.selectDateHint")}
                    </div>
                  )}

                  {preferredDate && resolvedPreferredTime ? (
                    <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                      {t("client.request.calendar.selection", {
                        date: formatAvailabilityDate(preferredDate),
                        time: formatTime(resolvedPreferredTime),
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

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
