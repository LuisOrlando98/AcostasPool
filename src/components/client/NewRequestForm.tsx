"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import { MIN_BOOKING_LEAD_DAYS } from "@/lib/jobs/capacity";
import {
  REQUEST_CATEGORY_VALUES,
  REQUEST_ISSUE_OPTIONS,
  type RequestCategory,
} from "@/lib/customers/request-categories";

type PropertyOption = {
  id: string;
  address: string;
};

type PropertiesResponse = {
  properties: PropertyOption[];
  allowWeekendBooking?: boolean;
};

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function CategoryIcon({ category }: { category: RequestCategory }) {
  if (category === "HYDRAULIC") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3s6 7.2 6 11.2a6 6 0 1 1-12 0C6 10.2 12 3 12 3z" />
      </svg>
    );
  }
  if (category === "ELECTRICAL") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
      </svg>
    );
  }
  if (category === "STRUCTURE") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0" />
        <rect x="4" y="8" width="16" height="10" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17h.01" />
    </svg>
  );
}

export default function NewRequestForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const localeTag = locale === "es" ? "es-US" : "en-US";

  const [category, setCategory] = useState<RequestCategory | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [allowWeekendBooking, setAllowWeekendBooking] = useState(false);
  const [availableWeekdays, setAvailableWeekdays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/client/properties")
      .then((res) => res.json())
      .catch(() => ({ properties: [], allowWeekendBooking: false }) as PropertiesResponse)
      .then((data: PropertiesResponse) => {
        if (cancelled) {
          return;
        }
        const nextProperties = Array.isArray(data.properties) ? data.properties : [];
        setProperties(nextProperties);
        setAllowWeekendBooking(Boolean(data.allowWeekendBooking));
        if (nextProperties.length > 0) {
          setPropertyId(nextProperties[0].id);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const weekdayOptions = useMemo(() => {
    const sunday = DateTime.fromObject(
      { year: 2024, month: 1, day: 7 },
      { zone: BUSINESS_TIMEZONE }
    );
    const days = allowWeekendBooking
      ? WEEKDAY_ORDER
      : WEEKDAY_ORDER.filter((day) => day !== 0 && day !== 6);
    return days.map((value) => {
      const label = sunday
        .plus({ days: value })
        .setLocale(localeTag)
        .toLocaleString({ weekday: "short" })
        .replace(".", "");
      return {
        value,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      };
    });
  }, [allowWeekendBooking, localeTag]);

  const toggleWeekday = (day: number) => {
    setAvailableWeekdays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort()
    );
    setMessage(null);
  };

  const selectCategory = (next: RequestCategory) => {
    setCategory(next);
    setIssue(null);
    setMessage(null);
  };

  const handleSubmit = async () => {
    if (!category) {
      setMessage(t("client.request.errors.category"));
      return;
    }
    if (!propertyId) {
      setMessage(t("client.request.errors.property"));
      return;
    }
    if (!description.trim()) {
      setMessage(t("client.request.errors.description"));
      return;
    }
    if (availableWeekdays.length === 0) {
      setMessage(t("client.request.errors.availableDays"));
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/client/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        category,
        issue: issue ?? undefined,
        description: description.trim(),
        urgent,
        availableWeekdays,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };

    if (!res.ok) {
      setMessage(data.error ?? t("client.request.errors.submit"));
      setLoading(false);
      return;
    }

    setLoading(false);
    setShowConfirmationModal(true);
  };

  const closeConfirmation = () => {
    setShowConfirmationModal(false);
    setCategory(null);
    setIssue(null);
    setDescription("");
    setUrgent(false);
    setAvailableWeekdays([]);
    router.refresh();
  };

  return (
    <section className="app-card p-4 shadow-contrast sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("client.request.formTitle")}</h2>
        <p className="text-sm text-slate-500">{t("client.request.formSubtitle")}</p>
      </div>

      <div className="mt-5 space-y-5">
        <div>
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
          <label className="text-sm font-semibold text-slate-700">
            {t("client.request.fields.category")}
          </label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {REQUEST_CATEGORY_VALUES.map((value) => {
              const isSelected = category === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectCategory(value)}
                  className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition ${
                    isSelected
                      ? "border-sky-500 bg-sky-50 text-sky-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50/40"
                  }`}
                >
                  <span className={`h-7 w-7 ${isSelected ? "text-sky-600" : "text-slate-500"}`}>
                    <CategoryIcon category={value} />
                  </span>
                  <span className="text-sm font-semibold leading-tight">
                    {t(`client.request.categories.${value}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {category && category !== "OTHER" ? (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("client.request.fields.issue")}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {REQUEST_ISSUE_OPTIONS[category].map((value) => {
                const isSelected = issue === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setIssue(value)}
                    className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                      isSelected
                        ? "border-sky-500 bg-sky-50 text-sky-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50/50"
                    }`}
                  >
                    {t(`client.request.issues.${value}`)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {category ? (
          <>
            <div>
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

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(event) => setUrgent(event.target.checked)}
                className="app-toggle"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  {t("client.request.fields.urgent")}
                </span>
                <span className="block text-xs text-slate-500">
                  {t("client.request.fields.urgentHint")}
                </span>
              </span>
            </label>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("client.request.fields.availableDays")}
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {weekdayOptions.map((day) => {
                  const isSelected = availableWeekdays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWeekday(day.value)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        isSelected
                          ? "border-sky-500 bg-sky-50 text-sky-800"
                          : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50/50"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {t("client.request.availableDaysHint", { days: String(MIN_BOOKING_LEAD_DAYS) })}
              </p>
            </div>

            {message ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {message}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">{t("client.request.notice")}</p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="app-button-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-70"
              >
                {loading ? t("client.request.loading") : t("client.request.submit")}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {showConfirmationModal ? (
        <div className="app-modal-layer fixed inset-0 z-[1300] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
          <button
            type="button"
            className="app-modal-backdrop absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            aria-label={t("common.actions.close")}
            onClick={closeConfirmation}
          />
          <div className="app-modal-card relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-2xl">
            <div className="bg-[linear-gradient(120deg,rgba(14,165,233,0.18),rgba(34,197,94,0.14),rgba(255,255,255,0.95))] p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                {t("client.request.confirmation.kicker")}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {t("client.request.confirmation.title")}
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                {t("client.request.confirmation.body")}
              </p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={closeConfirmation}
                  className="app-button-primary px-4 py-2 text-sm font-semibold"
                >
                  {t("client.request.confirmation.continue")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
