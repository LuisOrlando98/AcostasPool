"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";

type ChecklistItem = { label?: string; completed?: boolean };

type ServiceTierDto = {
  id: string;
  name: string;
  checklist?: ChecklistItem[] | null;
  isActive: boolean;
};

type ServiceTierDraft = {
  id: string;
  name: string;
  checklistText: string;
  isActive: boolean;
  isNew?: boolean;
  saving?: boolean;
};

const toChecklistText = (items?: ChecklistItem[] | null) =>
  (items ?? [])
    .map((item) => String(item?.label ?? "").trim())
    .filter(Boolean)
    .join("\n");

const parseChecklistText = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label) => ({ label, completed: false }));

export default function ServiceTiersManager() {
  const { t } = useI18n();
  const [tiers, setTiers] = useState<ServiceTierDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(
    () => tiers.filter((tier) => tier.isActive).length,
    [tiers]
  );

  const loadTiers = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/service-tiers");
    if (!res.ok) {
      setError(t("admin.settings.tiers.errors.load"));
      setLoading(false);
      return;
    }
    const data = await res.json().catch(() => ({ tiers: [] }));
    const next = Array.isArray(data.tiers)
      ? (data.tiers as ServiceTierDto[]).map((tier) => ({
          id: tier.id,
          name: tier.name,
          checklistText: toChecklistText(tier.checklist),
          isActive: Boolean(tier.isActive),
        }))
      : [];
    setTiers(next);
    setLoading(false);
  };

  useEffect(() => {
    loadTiers();
  }, []);

  const updateTier = (id: string, patch: Partial<ServiceTierDraft>) => {
    setTiers((current) =>
      current.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier))
    );
  };

  const addTier = () => {
    const newTier: ServiceTierDraft = {
      id: `new-${crypto.randomUUID()}`,
      name: t("admin.settings.tiers.defaults.name"),
      checklistText: "",
      isActive: true,
      isNew: true,
    };
    setTiers((current) => [newTier, ...current]);
  };

  const saveTier = async (tier: ServiceTierDraft) => {
    const payload = {
      name: tier.name.trim(),
      checklist: parseChecklistText(tier.checklistText),
      isActive: tier.isActive,
    };
    if (!payload.name) {
      setError(t("admin.settings.tiers.errors.name"));
      return;
    }
    updateTier(tier.id, { saving: true });
    const res = await fetch(
      tier.isNew ? "/api/admin/service-tiers" : `/api/admin/service-tiers/${tier.id}`,
      {
        method: tier.isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      setError(t("admin.settings.tiers.errors.save"));
      updateTier(tier.id, { saving: false });
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (tier.isNew && data?.tier?.id) {
      updateTier(tier.id, {
        id: data.tier.id,
        isNew: false,
        saving: false,
      });
    } else {
      updateTier(tier.id, { saving: false });
    }
    setError(null);
  };

  const removeTier = async (tier: ServiceTierDraft) => {
    if (tier.isNew) {
      setTiers((current) => current.filter((item) => item.id !== tier.id));
      return;
    }
    updateTier(tier.id, { saving: true });
    const res = await fetch(`/api/admin/service-tiers/${tier.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError(t("admin.settings.tiers.errors.delete"));
      updateTier(tier.id, { saving: false });
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data?.archived) {
      updateTier(tier.id, { isActive: false, saving: false });
      setError(null);
      return;
    }
    setTiers((current) => current.filter((item) => item.id !== tier.id));
    setError(null);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        {t("admin.settings.tiers.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">
            {t("admin.settings.tiers.helper", { count: activeCount })}
          </p>
        </div>
        <button
          type="button"
          onClick={addTier}
          className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
        >
          {t("admin.settings.tiers.actions.add")}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        {tiers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {t("admin.settings.tiers.empty")}
          </div>
        ) : (
          tiers.map((tier) => (
            <div
              key={tier.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    value={tier.name}
                    onChange={(event) =>
                      updateTier(tier.id, { name: event.target.value })
                    }
                    className="app-input w-56 px-3 py-2 text-sm"
                    placeholder={t("admin.settings.tiers.placeholders.name")}
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={tier.isActive}
                      onChange={(event) =>
                        updateTier(tier.id, { isActive: event.target.checked })
                      }
                    />
                    {tier.isActive
                      ? t("admin.settings.tiers.status.active")
                      : t("admin.settings.tiers.status.inactive")}
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveTier(tier)}
                    className="app-button-primary px-4 py-2 text-xs font-semibold"
                    disabled={tier.saving}
                  >
                    {tier.saving
                      ? t("admin.settings.tiers.actions.saving")
                      : t("common.actions.save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTier(tier)}
                    className="app-button-ghost px-4 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700"
                    disabled={tier.saving}
                  >
                    {tier.isNew
                      ? t("common.actions.delete")
                      : t("admin.settings.tiers.actions.deactivate")}
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t("admin.settings.tiers.labels.checklist")}
                </label>
                <textarea
                  value={tier.checklistText}
                  onChange={(event) =>
                    updateTier(tier.id, { checklistText: event.target.value })
                  }
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder={t("admin.settings.tiers.placeholders.checklist")}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
