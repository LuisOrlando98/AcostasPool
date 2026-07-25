"use client";

import AppShell from "@/components/layout/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import { MIN_BOOKING_LEAD_DAYS } from "@/lib/jobs/capacity";

type PropertyOption = {
  id: string;
  address: string;
};

type PropertiesResponse = {
  properties: PropertyOption[];
  allowWeekendBooking?: boolean;
};

type ReasonKey = "EMERGENCY" | "QUICK_CLEANING" | "CHEM_BALANCE" | "GENERAL" | "OTHER";

const CANNED_REASON_KEYS: Exclude<ReasonKey, "OTHER">[] = [
  "EMERGENCY",
  "QUICK_CLEANING",
  "CHEM_BALANCE",
  "GENERAL",
];

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ClientRequestPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const localeTag = locale === "es" ? "es-US" : "en-US";

  const [description, setDescription] = useState("");
  const [reasonKey, setReasonKey] = useState<ReasonKey>("EMERGENCY");
  const [reasonOtherText, setReasonOtherText] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [allowWeekendBooking, setAllowWeekendBooking] = useState(false);
  const [availableWeekdays, setAvailableWeekdays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
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

  const reasonLabels: Record<Exclude<ReasonKey, "OTHER">, string> = {
    EMERGENCY: t("client.request.reasons.emergency"),
    QUICK_CLEANING: t("client.request.reasons.quickCleaning"),
    CHEM_BALANCE: t("client.request.reasons.chemBalance"),
    GENERAL: t("client.request.reasons.general"),
  };

  const toggleWeekday = (day: number) => {
    setAvailableWeekdays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort()
    );
    setMessage(null);
  };

  const handleSubmit = async () => {
    if (!propertyId) {
      setMessage(t("client.request.errors.property"));
      return;
    }

    if (availableWeekdays.length === 0) {
      setMessage(t("client.request.errors.availableDays"));
      return;
    }

    if (reasonKey === "OTHER" && !reasonOtherText.trim()) {
      setMessage(t("client.request.errors.reasonOther"));
      return;
    }

    const resolvedReason =
      reasonKey === "OTHER"
        ? `${t("client.request.reasons.other")}: ${reasonOtherText.trim()}`
        : reasonLabels[reasonKey];

    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/client/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        reason: resolvedReason,
        description,
        availableWeekdays,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };

    if (!res.ok) {
      setMessage(data.error ?? t("client.request.errors.submit"));
      setLoading(false);
      return;
    }

    setMessage(null);
    setConfirmationMessage(t("client.request.successThankYou"));
    setShowConfirmationModal(true);
    setLoading(false);
  };

  return (
    <AppShell
      title={t("client.request.title")}
      subtitle={t("client.request.subtitle")}
      role="CUSTOMER"
    >
      <section className="app-card p-4 shadow-contrast sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t("client.request.formTitle")}</h2>
          <p className="text-sm text-slate-500">{t("client.request.formSubtitle")}</p>
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

          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("client.request.fields.reason")}
            </label>
            <select
              value={reasonKey}
              onChange={(event) => setReasonKey(event.target.value as ReasonKey)}
              className="app-input mt-2 w-full bg-white px-4 py-3 text-sm text-slate-700"
            >
              {CANNED_REASON_KEYS.map((key) => (
                <option key={key} value={key}>
                  {reasonLabels[key]}
                </option>
              ))}
              <option value="OTHER">{t("client.request.reasons.other")}</option>
            </select>
          </div>

          {reasonKey === "OTHER" ? (
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("client.request.reasons.other")}
              </label>
              <input
                type="text"
                value={reasonOtherText}
                onChange={(event) => setReasonOtherText(event.target.value)}
                className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
                placeholder={t("client.request.placeholders.reasonOther")}
              />
            </div>
          ) : null}

          <div className="md:col-span-2">
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
            <div className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {message}
            </div>
          ) : null}

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">{t("client.request.notice")}</p>
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
              <p className="mt-3 text-sm text-slate-600">{confirmationMessage}</p>
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
