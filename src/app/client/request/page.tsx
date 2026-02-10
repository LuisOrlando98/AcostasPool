"use client";

import AppShell from "@/components/layout/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";

type PropertyOption = {
  id: string;
  address: string;
};

export default function ClientRequestPage() {
  const { t } = useI18n();
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
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

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/client/properties");
      const data = (await res.json().catch(() => ({ properties: [] }))) as {
        properties: PropertyOption[];
      };
      setProperties(data.properties);
      if (data.properties.length > 0) {
        setPropertyId(data.properties[0].id);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!serviceOptions.includes(reason)) {
      setReason(serviceOptions[0]);
    }
  }, [serviceOptions, reason]);

  const handleSubmit = async () => {
    if (!propertyId) {
      setMessage(t("client.request.errors.property"));
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/client/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        reason,
        preferredDate,
        preferredTime,
        description,
      }),
    });
    if (!res.ok) {
      setMessage(t("client.request.errors.submit"));
      setLoading(false);
      return;
    }
    setMessage(t("client.request.success"));
    setLoading(false);
  };

  return (
    <AppShell
      title={t("client.request.title")}
      subtitle={t("client.request.subtitle")}
      role="CUSTOMER"
    >
      <section className="app-card p-6 shadow-contrast">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {t("client.request.formTitle")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("client.request.formSubtitle")}
            </p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
            {t("client.request.responseTime")}
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
                <option value="">
                  {t("client.request.fields.noProperty")}
                </option>
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
              value={reason}
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

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("client.request.fields.preferredDate")}
            </label>
            <input
              type="date"
              value={preferredDate}
              onChange={(event) => setPreferredDate(event.target.value)}
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
            <div className="app-callout md:col-span-2 px-4 py-3 text-sm" data-tone="info">
              {message}
            </div>
          ) : null}

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {t("client.request.notice")}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="app-button-primary px-5 py-2 text-sm font-semibold disabled:opacity-70"
            >
              {loading
                ? t("client.request.loading")
                : t("client.request.submit")}
            </button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
