"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
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
  newItemText?: string;
};

const createClientId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tier-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getChecklistLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const toChecklistText = (items?: ChecklistItem[] | null) =>
  (items ?? [])
    .map((item) => String(item?.label ?? "").trim())
    .filter(Boolean)
    .join("\n");

const parseChecklistText = (value: string) =>
  getChecklistLines(value).map((label) => ({ label, completed: false }));

const countChecklistItems = (value: string) =>
  getChecklistLines(value).length;

const normalizeChecklistText = (items: string[]) =>
  items.map((item) => item.trim()).filter(Boolean).join("\n");

export default function ServiceTiersManager() {
  const { t } = useI18n();
  const [tiers, setTiers] = useState<ServiceTierDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeCount = useMemo(
    () => tiers.filter((tier) => tier.isActive).length,
    [tiers]
  );
  const visibleTiers = useMemo(
    () => (showInactive ? tiers : tiers.filter((tier) => tier.isActive)),
    [showInactive, tiers]
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
          newItemText: "",
        }))
      : [];
    setTiers(next);
    const nextSaved = new Map<string, string>();
    next.forEach((tier) => {
      nextSaved.set(
        tier.id,
        JSON.stringify({
          name: tier.name.trim(),
          checklist: parseChecklistText(tier.checklistText),
          isActive: tier.isActive,
        })
      );
    });
    lastSavedPayload.current = nextSaved;
    setLoading(false);
  };

  useEffect(() => {
    loadTiers();
  }, []);

  const updateTier = (
    id: string,
    patch: Partial<ServiceTierDraft>,
    options?: { silent?: boolean }
  ) => {
    setTiers((current) =>
      current.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier))
    );
    if (!options?.silent) {
      const keys = Object.keys(patch);
      const shouldSave = keys.some(
        (key) => key !== "newItemText" && key !== "saving"
      );
      if (shouldSave) {
        scheduleSave(id);
      }
    }
  };

  const addTier = () => {
    const newTier: ServiceTierDraft = {
      id: `new-${createClientId()}`,
      name: t("admin.settings.tiers.defaults.name"),
      checklistText: "",
      isActive: true,
      isNew: true,
      newItemText: "",
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
    updateTier(tier.id, { saving: true }, { silent: true });
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
      updateTier(tier.id, { saving: false }, { silent: true });
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (tier.isNew && data?.tier?.id) {
      updateTier(
        tier.id,
        {
          id: data.tier.id,
          isNew: false,
          saving: false,
        },
        { silent: true }
      );
      const nextKey = data.tier.id as string;
      const payloadKey = JSON.stringify(payload);
      lastSavedPayload.current.delete(tier.id);
      lastSavedPayload.current.set(nextKey, payloadKey);
    } else {
      updateTier(tier.id, { saving: false }, { silent: true });
      lastSavedPayload.current.set(tier.id, JSON.stringify(payload));
    }
    setError(null);
  };

  const tiersRef = useRef<ServiceTierDraft[]>([]);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const lastSavedPayload = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    tiersRef.current = tiers;
  }, [tiers]);

  const scheduleSave = (id: string) => {
    const currentTier = tiersRef.current.find((tier) => tier.id === id);
    if (!currentTier) {
      return;
    }
    const payload = {
      name: currentTier.name.trim(),
      checklist: parseChecklistText(currentTier.checklistText),
      isActive: currentTier.isActive,
    };
    if (!payload.name) {
      return;
    }
    const payloadKey = JSON.stringify(payload);
    if (lastSavedPayload.current.get(id) === payloadKey) {
      return;
    }
    const existing = saveTimers.current.get(id);
    if (existing) {
      clearTimeout(existing);
    }
    const timeout = setTimeout(() => {
      const latestTier = tiersRef.current.find((tier) => tier.id === id);
      if (!latestTier) {
        return;
      }
      void saveTier(latestTier);
    }, 650);
    saveTimers.current.set(id, timeout);
  };

  const addChecklistItem = (tier: ServiceTierDraft) => {
    const nextItem = (tier.newItemText ?? "").trim();
    if (!nextItem) {
      return;
    }
    const items = getChecklistLines(tier.checklistText);
    updateTier(tier.id, {
      checklistText: normalizeChecklistText([...items, nextItem]),
      newItemText: "",
    });
  };

  const removeChecklistItem = (tier: ServiceTierDraft, index: number) => {
    const items = getChecklistLines(tier.checklistText);
    items.splice(index, 1);
    updateTier(tier.id, { checklistText: normalizeChecklistText(items) });
  };

  const reorderChecklistItem = (
    tier: ServiceTierDraft,
    fromIndex: number,
    toIndex: number
  ) => {
    const items = getChecklistLines(tier.checklistText);
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= items.length) {
      return;
    }
    const safeIndex = Math.max(0, Math.min(toIndex, items.length));
    const [moved] = items.splice(fromIndex, 1);
    items.splice(safeIndex, 0, moved);
    updateTier(tier.id, { checklistText: normalizeChecklistText(items) });
  };

  const [dragState, setDragState] = useState<{
    tierId: string;
    fromIndex: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState<{
    tierId: string;
    index: number;
  } | null>(null);

  const beginDrag = (tierId: string, index: number) => (
    event: DragEvent<HTMLButtonElement>
  ) => {
    setDragState({ tierId, fromIndex: index });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${tierId}:${index}`);
  };

  const clearDragState = () => {
    setDragState(null);
    setDragOver(null);
  };

  const handleDropOnItem = (tier: ServiceTierDraft, index: number) => (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const state = dragState;
    if (!state || state.tierId !== tier.id) {
      clearDragState();
      return;
    }
    let targetIndex = index;
    if (state.fromIndex < targetIndex) {
      targetIndex -= 1;
    }
    reorderChecklistItem(tier, state.fromIndex, targetIndex);
    clearDragState();
  };

  const handleDropOnList = (tier: ServiceTierDraft) => (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    const state = dragState;
    if (!state || state.tierId !== tier.id) {
      clearDragState();
      return;
    }
    const items = getChecklistLines(tier.checklistText);
    reorderChecklistItem(tier, state.fromIndex, items.length);
    clearDragState();
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="app-chip px-3 py-1 text-xs font-semibold">
            {t("admin.settings.tiers.helper", { count: activeCount })}
          </span>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              className="app-toggle"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            {showInactive
              ? t("admin.settings.tiers.actions.hideInactive")
              : t("admin.settings.tiers.actions.showInactive")}
          </label>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleTiers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {t("admin.settings.tiers.empty")}
          </div>
        ) : (
          visibleTiers.map((tier) => {
              const checklistItems = getChecklistLines(tier.checklistText);
              return (
                <div
                  key={tier.id}
                  className={`flex h-full flex-col rounded-2xl border p-4 shadow-sm ${
                    tier.isActive
                      ? "border-sky-200 bg-white"
                      : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <div className="flex flex-1 flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          value={tier.name}
                          onChange={(event) =>
                            updateTier(tier.id, { name: event.target.value })
                          }
                          className="app-input flex-1 min-w-[10rem] px-3 py-2 text-sm"
                          placeholder={t(
                            "admin.settings.tiers.placeholders.name"
                          )}
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="app-toggle"
                            checked={tier.isActive}
                            onChange={(event) =>
                              updateTier(tier.id, {
                                isActive: event.target.checked,
                              })
                            }
                          />
                          <span
                            className="app-chip px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
                            data-tone={tier.isActive ? "success" : "warning"}
                          >
                            {tier.isActive
                              ? t("admin.settings.tiers.status.active")
                              : t("admin.settings.tiers.status.inactive")}
                          </span>
                        </div>
                      </div>
                      {tier.saving ? (
                        <div className="flex items-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {t("admin.settings.tiers.actions.saving")}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {t("admin.settings.tiers.labels.checklist")}
                        <span className="ml-2 text-[10px] font-semibold text-slate-400">
                          ({countChecklistItems(tier.checklistText)})
                        </span>
                      </label>
                      <span className="text-xs text-slate-400">
                        {t("admin.settings.tiers.placeholders.checklist")}
                      </span>
                    </div>

                    <div className="flex-1 rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm">
                      <div
                        className="space-y-2 text-sm text-slate-600"
                        onDragOver={(event) => {
                          if (dragState?.tierId === tier.id) {
                            event.preventDefault();
                          }
                        }}
                        onDrop={handleDropOnList(tier)}
                      >
                        {checklistItems.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                            {t("admin.settings.tiers.placeholders.checklist")}
                          </div>
                        ) : (
                          checklistItems.map((item, index) => {
                            const isDropTarget =
                              dragOver?.tierId === tier.id &&
                              dragOver.index === index;
                            return (
                              <div
                                key={`${tier.id}-${index}`}
                                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                                  isDropTarget
                                    ? "border-sky-200 bg-sky-50/70"
                                    : "border-slate-100 bg-white"
                                }`}
                                onDragOver={(event) => {
                                  if (
                                    dragState?.tierId === tier.id &&
                                    dragState.fromIndex !== index
                                  ) {
                                    event.preventDefault();
                                    setDragOver({ tierId: tier.id, index });
                                  }
                                }}
                                onDragLeave={() => {
                                  if (
                                    dragOver?.tierId === tier.id &&
                                    dragOver.index === index
                                  ) {
                                    setDragOver(null);
                                  }
                                }}
                                onDrop={handleDropOnItem(tier, index)}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-400"
                                    aria-hidden="true"
                                  />
                                  <span className="text-slate-700">{item}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    className="app-button-ghost px-2 py-1 text-[10px] font-semibold text-slate-500 cursor-grab active:cursor-grabbing"
                                    draggable
                                    onDragStart={beginDrag(tier.id, index)}
                                    onDragEnd={clearDragState}
                                    aria-label="Drag"
                                  >
                                    |||
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeChecklistItem(tier, index)
                                    }
                                    className="app-button-ghost px-2 py-1 text-[10px] font-semibold text-slate-500 hover:text-rose-600"
                                  >
                                    {t("common.actions.delete")}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={tier.newItemText ?? ""}
                        onChange={(event) =>
                          updateTier(tier.id, {
                            newItemText: event.target.value,
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addChecklistItem(tier);
                          }
                        }}
                        className="app-input flex-1 px-3 py-2 text-sm"
                        placeholder={t(
                          "admin.settings.tiers.placeholders.checklist"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => addChecklistItem(tier)}
                        className="app-button-secondary px-3 py-2 text-xs font-semibold"
                      >
                        {t("common.actions.add")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
          )
        )}
      </div>
    </div>
  );
}
