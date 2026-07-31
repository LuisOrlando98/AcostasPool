"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";

type Preference = {
  eventType: string;
  enabled: boolean;
};

const EVENT_COLOR: Record<string, string> = {
  JOB_COMPLETED: "bg-emerald-100 text-emerald-700",
  CUSTOMER_REQUEST: "bg-amber-100 text-amber-700",
  SERVICE_SCHEDULED: "bg-sky-100 text-sky-700",
  SERVICE_RESCHEDULED: "bg-cyan-100 text-cyan-700",
  ROUTE_UPDATED: "bg-violet-100 text-violet-700",
  INVOICE_SENT: "bg-indigo-100 text-indigo-700",
  PAYMENT_RECEIVED: "bg-emerald-100 text-emerald-700",
  MEMBERSHIP_PAYMENT_FAILED: "bg-rose-100 text-rose-700",
};

function humanizeEventType(eventType: string) {
  return eventType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function NotificationPreferences() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [savedEvent, setSavedEvent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/notifications/preferences");
        const data = await res.json().catch(() => ({ preferences: [] }));
        if (!cancelled) {
          setPrefs(Array.isArray(data.preferences) ? data.preferences : []);
        }
      } catch {
        if (!cancelled) {
          setPrefs([]);
          setError(t("notifications.preferences.loadError"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const enabledCount = useMemo(
    () => prefs.filter((pref) => pref.enabled).length,
    [prefs]
  );

  const toggle = async (eventType: string, nextEnabled: boolean) => {
    const previousEnabled =
      prefs.find((pref) => pref.eventType === eventType)?.enabled ?? true;

    setError(null);
    setSavingEvent(eventType);
    setPrefs((current) =>
      current.map((pref) =>
        pref.eventType === eventType
          ? { ...pref, enabled: nextEnabled }
          : pref
      )
    );

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, enabled: nextEnabled }),
      });

      if (!response.ok) {
        throw new Error("Unable to save preference");
      }
      setSavedEvent(eventType);
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
      savedTimerRef.current = setTimeout(() => {
        setSavedEvent(null);
      }, 1600);
    } catch {
      setPrefs((current) =>
        current.map((pref) =>
          pref.eventType === eventType
            ? { ...pref, enabled: previousEnabled }
            : pref
        )
      );
      setError(t("notifications.preferences.saveError"));
    } finally {
      setSavingEvent(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
          />
        ))}
      </div>
    );
  }

  if (prefs.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-700">
          {t("notifications.preferences.emptyTitle")}
        </p>
        <p className="mt-1">{t("notifications.preferences.emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            {t("notifications.preferences.helper")}
          </p>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {t("notifications.preferences.enabledCount", {
              enabled: String(enabledCount),
              total: String(prefs.length),
            })}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3">
        {prefs.map((pref) => {
          const label = t(`notifications.types.${pref.eventType}`);
          const resolvedLabel =
            label.includes("notifications.types.")
              ? humanizeEventType(pref.eventType)
              : label;
          const description = t(
            `notifications.preferences.descriptions.${pref.eventType}`
          );
          const resolvedDescription =
            description.includes("notifications.preferences.descriptions.")
              ? t("notifications.preferences.defaultDescription")
              : description;
          const isSaving = savingEvent === pref.eventType;
          const isSaved = savedEvent === pref.eventType;
          const toneClass = EVENT_COLOR[pref.eventType] ?? "bg-slate-100 text-slate-700";

          return (
            <div
              key={pref.eventType}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}
                    >
                      {resolvedLabel.slice(0, 2)}
                    </span>
                    <p className="text-sm font-semibold text-slate-900">{resolvedLabel}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{resolvedDescription}</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {pref.enabled
                      ? t("notifications.preferences.statusOn")
                      : t("notifications.preferences.statusOff")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggle(pref.eventType, !pref.enabled)}
                  disabled={isSaving}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
                    pref.enabled
                      ? "border-sky-500 bg-sky-500"
                      : "border-slate-300 bg-slate-200"
                  } ${isSaving ? "cursor-wait opacity-80" : "cursor-pointer"}`}
                  aria-label={resolvedLabel}
                  aria-pressed={pref.enabled}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      pref.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {isSaving ? (
                <p className="mt-2 text-xs text-slate-500">
                  {t("notifications.preferences.saving")}
                </p>
              ) : isSaved ? (
                <p className="mt-2 text-xs font-semibold text-emerald-600">
                  {t("common.feedback.saved")}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
