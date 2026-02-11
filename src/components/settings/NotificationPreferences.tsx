"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

type Preference = {
  eventType: string;
  enabled: boolean;
};

export default function NotificationPreferences() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/notifications/preferences");
      const data = await res.json().catch(() => ({ preferences: [] }));
      setPrefs(Array.isArray(data.preferences) ? data.preferences : []);
      setLoading(false);
    };
    load();
  }, []);

  const toggle = async (eventType: string, nextEnabled: boolean) => {
    setPrefs((current) =>
      current.map((pref) =>
        pref.eventType === eventType
          ? { ...pref, enabled: nextEnabled }
          : pref
      )
    );
    await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, enabled: nextEnabled }),
    });
  };

  if (loading) {
    return <div className="text-sm text-slate-500">...</div>;
  }

  if (prefs.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        {t("notifications.none")}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2 text-sm text-slate-600">
      {prefs.map((pref) => {
        const label = t(`notifications.types.${pref.eventType}`);
        const resolvedLabel = label.includes("notifications.types.")
          ? pref.eventType.replaceAll("_", " ")
          : label;
        return (
          <label
            key={pref.eventType}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
          >
            <span className="text-sm text-slate-700">{resolvedLabel}</span>
            <input
              type="checkbox"
              className="app-toggle"
              checked={pref.enabled}
              onChange={(event) => toggle(pref.eventType, event.target.checked)}
            />
          </label>
        );
      })}
    </div>
  );
}
