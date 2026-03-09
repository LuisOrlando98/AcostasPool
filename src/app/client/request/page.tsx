"use client";

import AppShell from "@/components/layout/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE, parseBusinessDateInput } from "@/lib/timezone";

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

type PropertiesResponse = {
  properties: PropertyOption[];
  customerType?: "RESIDENTIAL" | "COMMERCIAL";
  pauseServicesFrom?: string | null;
};

function parseDateKey(value: string) {
  return parseBusinessDateInput(value);
}

function toDateKey(value: Date) {
  return DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE).toFormat("yyyy-MM-dd");
}

function startOfMonth(value: Date) {
  return DateTime.fromJSDate(value)
    .setZone(BUSINESS_TIMEZONE)
    .startOf("month")
    .toUTC()
    .toJSDate();
}

function addMonths(value: Date, months: number) {
  return DateTime.fromJSDate(value)
    .setZone(BUSINESS_TIMEZONE)
    .plus({ months })
    .startOf("month")
    .toUTC()
    .toJSDate();
}

function isSameMonth(a: Date, b: Date) {
  return (
    DateTime.fromJSDate(a).setZone(BUSINESS_TIMEZONE).toFormat("yyyy-MM") ===
    DateTime.fromJSDate(b).setZone(BUSINESS_TIMEZONE).toFormat("yyyy-MM")
  );
}

function getBusinessWeekdayIndex(value: Date) {
  return DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE).weekday % 7;
}

function getBusinessDayNumber(value: Date) {
  return DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE).day;
}

export default function ClientRequestPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const localeTag = locale === "es" ? "es-US" : "en-US";

  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [mode, setMode] = useState<"SINGLE" | "RECURRING">("SINGLE");
  const [visitsPerWeek, setVisitsPerWeek] = useState(1);
  const [customerType, setCustomerType] = useState<"RESIDENTIAL" | "COMMERCIAL">(
    "RESIDENTIAL"
  );
  const [pauseServicesFrom, setPauseServicesFrom] = useState<string | null>(null);
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
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [propertiesRes, availabilityRes] = await Promise.all([
        fetch("/api/client/properties"),
        fetch("/api/client/availability?days=84"),
      ]);

      const propertiesData = (await propertiesRes
        .json()
        .catch(
          () =>
            ({
              properties: [],
              customerType: "RESIDENTIAL",
              pauseServicesFrom: null,
            }) as PropertiesResponse
        )) as PropertiesResponse;

      if (!cancelled) {
        const nextProperties = Array.isArray(propertiesData.properties)
          ? propertiesData.properties
          : [];
        setProperties(nextProperties);
        setCustomerType(
          propertiesData.customerType === "COMMERCIAL" ? "COMMERCIAL" : "RESIDENTIAL"
        );
        setPauseServicesFrom(
          typeof propertiesData.pauseServicesFrom === "string"
            ? propertiesData.pauseServicesFrom
            : null
        );
        if (nextProperties.length > 0) {
          setPropertyId(nextProperties[0].id);
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

  useEffect(() => {
    if (!showConfirmationModal) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      router.push("/client");
    }, 1800);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [router, showConfirmationModal]);

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
    const sunday = DateTime.fromObject(
      { year: 2024, month: 1, day: 7 },
      { zone: BUSINESS_TIMEZONE }
    );
    return Array.from({ length: 7 }, (_, index) => {
      return sunday
        .plus({ days: index })
        .setLocale(localeTag)
        .toLocaleString({
          weekday: "short",
        })
        .replace(".", "")
        .slice(0, 2)
        .toUpperCase();
    });
  }, [localeTag]);

  const calendarDays = useMemo(() => {
    const monthStart = DateTime.fromJSDate(calendarMonth)
      .setZone(BUSINESS_TIMEZONE)
      .startOf("month");
    const monthEnd = monthStart.endOf("month");
    const gridStart = monthStart
      .minus({ days: monthStart.weekday % 7 })
      .startOf("day");
    const gridEnd = monthEnd
      .plus({ days: 6 - (monthEnd.weekday % 7) })
      .endOf("day");
    const days: Date[] = [];
    for (
      let cursor = gridStart;
      cursor.toMillis() <= gridEnd.toMillis();
      cursor = cursor.plus({ days: 1 })
    ) {
      days.push(cursor.toUTC().toJSDate());
    }

    return days;
  }, [calendarMonth]);

  const resolvedReason = serviceOptions.includes(reason)
    ? reason
    : serviceOptions[0];
  const maxRecurringVisits = customerType === "COMMERCIAL" ? 5 : 2;
  const resolvedVisitsPerWeek =
    visitsPerWeek > maxRecurringVisits ? maxRecurringVisits : visitsPerWeek;
  const recurringVisitOptions = Array.from(
    { length: maxRecurringVisits },
    (_, index) => index + 1
  );
  const recurringPaused = Boolean(pauseServicesFrom);

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
      timeZone: BUSINESS_TIMEZONE,
    });
  };

  const formatTime = (value: string) => {
    const parsed = DateTime.fromFormat(value, "HH:mm", { zone: BUSINESS_TIMEZONE });
    if (!parsed.isValid) {
      return value;
    }
    return parsed.setLocale(localeTag).toLocaleString({
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

    if (mode === "RECURRING" && recurringPaused) {
      setMessageTone("error");
      setMessage(t("client.request.errors.recurringPaused"));
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
        visitsPerWeek: resolvedVisitsPerWeek,
        urgentOverride,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      reviewRequired?: boolean;
      partial?: boolean;
      createdCount?: number;
      createdPlanCount?: number;
      mode?: "SINGLE" | "RECURRING";
    };

    if (!res.ok) {
      setMessageTone("error");
      setMessage(data.error ?? t("client.request.errors.submit"));
      setLoading(false);
      return;
    }

    const successCopy = data.reviewRequired
      ? t("client.request.successReview")
      : mode === "RECURRING"
        ? t("client.request.successRecurringConfigured", {
            visits: String(resolvedVisitsPerWeek),
            plans: String(data.createdPlanCount ?? 0),
          })
      : data.partial
        ? t("client.request.successPartial", {
            count: String(data.createdCount ?? 0),
          })
        : t("client.request.successCount", {
            count: String(data.createdCount ?? 1),
          });

    setMessageTone(data.reviewRequired || data.partial ? "warning" : "success");
    setMessage(null);
    setConfirmationMessage(successCopy);
    setShowConfirmationModal(true);

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
              value={resolvedVisitsPerWeek}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setVisitsPerWeek(Number.isFinite(nextValue) ? nextValue : 1);
              }}
              disabled={mode !== "RECURRING"}
              className="app-input mt-2 w-full bg-white px-4 py-3 text-sm text-slate-700 disabled:opacity-60"
            >
              {recurringVisitOptions.map((value) => (
                <option key={value} value={value}>
                  {value === 1
                    ? t("client.request.options.oncePerWeek")
                    : value === 2
                      ? t("client.request.options.twicePerWeek")
                      : t("client.request.options.visitsPerWeekCount", {
                          count: String(value),
                        })}
                </option>
              ))}
            </select>
          </div>

          {mode === "RECURRING" ? (
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
              {customerType === "COMMERCIAL"
                ? t("client.request.hints.recurringCommercial")
                : t("client.request.hints.recurringResidential")}
              {recurringPaused ? (
                <p className="mt-1 font-semibold text-amber-700">
                  {t("client.request.hints.recurringPaused")}
                </p>
              ) : null}
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
                          timeZone: BUSINESS_TIMEZONE,
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
                      const weekday = getBusinessWeekdayIndex(date);
                      const isWeekend = weekday === 0 || weekday === 6;
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
                            {getBusinessDayNumber(date)}
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
              disabled={loading || (mode === "RECURRING" && recurringPaused)}
              className="app-button-primary px-5 py-2 text-sm font-semibold disabled:opacity-70"
            >
              {loading ? t("client.request.loading") : t("client.request.submit")}
            </button>
          </div>
        </div>
      </section>

      {showConfirmationModal ? (
        <div className="app-modal-layer fixed inset-0 z-[1300] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
          <button
            type="button"
            className="app-modal-backdrop absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            aria-label={t("common.actions.close")}
            onClick={() => {
              setShowConfirmationModal(false);
              router.push("/client");
            }}
          />
          <div className="app-modal-card relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-2xl">
            <div className="bg-[linear-gradient(120deg,rgba(14,165,233,0.18),rgba(34,197,94,0.14),rgba(255,255,255,0.95))] p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                {locale === "es" ? "Solicitud enviada" : "Request sent"}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {locale === "es"
                  ? "Tu solicitud fue registrada correctamente"
                  : "Your request was submitted successfully"}
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                {confirmationMessage}
              </p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmationModal(false);
                    router.push("/client");
                  }}
                  className="app-button-primary px-4 py-2 text-sm font-semibold"
                >
                  {locale === "es" ? "Continuar" : "Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

