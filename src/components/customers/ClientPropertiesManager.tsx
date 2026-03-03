"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { getJobStatusLabel } from "@/lib/constants";

export type ClientPropertyItem = {
  id: string;
  name: string | null;
  address: string;
  poolType: string | null;
  waterType: string | null;
  sanitizerType: string | null;
  filterType: string | null;
  poolVolumeGallons: number | null;
  hasSpa: boolean;
  accessInfo: string | null;
  locationNotes: string | null;
};

export type ClientPropertyJob = {
  id: string;
  propertyId: string;
  propertyName: string | null;
  propertyAddress: string;
  status: string;
  type: "ROUTINE" | "ON_DEMAND";
  scheduledDate: string;
  completedAt: string | null;
  photosCount: number;
};

type Draft = {
  propertyId: string | null;
  name: string;
  address: string;
  poolType: string;
  waterType: string;
  sanitizerType: string;
  filterType: string;
  poolVolumeGallons: string;
  hasSpa: boolean;
  accessInfo: string;
  locationNotes: string;
};

type Props = {
  initialProperties: ClientPropertyItem[];
  initialJobs: ClientPropertyJob[];
};

const emptyDraft: Draft = {
  propertyId: null,
  name: "",
  address: "",
  poolType: "",
  waterType: "",
  sanitizerType: "",
  filterType: "",
  poolVolumeGallons: "",
  hasSpa: false,
  accessInfo: "",
  locationNotes: "",
};

const toDraft = (p: ClientPropertyItem): Draft => ({
  propertyId: p.id,
  name: p.name ?? "",
  address: p.address,
  poolType: p.poolType ?? "",
  waterType: p.waterType ?? "",
  sanitizerType: p.sanitizerType ?? "",
  filterType: p.filterType ?? "",
  poolVolumeGallons: p.poolVolumeGallons !== null ? String(p.poolVolumeGallons) : "",
  hasSpa: p.hasSpa,
  accessInfo: p.accessInfo ?? "",
  locationNotes: p.locationNotes ?? "",
});

const show = (v: string | null | undefined) => (v && v.trim() ? v : "-");

export default function ClientPropertiesManager({ initialProperties, initialJobs }: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [properties, setProperties] = useState(initialProperties);
  const [jobs, setJobs] = useState(initialJobs);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveSuccessTimerRef.current) {
        clearTimeout(saveSuccessTimerRef.current);
      }
    },
    []
  );

  const openCreate = () => {
    setMode("create");
    setDraft(emptyDraft);
    setError(null);
    setNotice(null);
    setConfirmOpen(false);
    setSaveSuccess(false);
    setEditorOpen(true);
  };

  const openEdit = (p: ClientPropertyItem) => {
    setMode("edit");
    setDraft(toDraft(p));
    setError(null);
    setNotice(null);
    setConfirmOpen(false);
    setSaveSuccess(false);
    setEditorOpen(true);
  };

  const closeModals = () => {
    if (saving) return;
    setEditorOpen(false);
    setConfirmOpen(false);
    setSaveSuccess(false);
    setError(null);
  };

  const statsByProperty = useMemo(() => {
    const map = new Map<string, { scheduled: number; completed: number }>();
    for (const j of jobs) {
      const current = map.get(j.propertyId) ?? { scheduled: 0, completed: 0 };
      if (j.status === "COMPLETED") current.completed += 1;
      else current.scheduled += 1;
      map.set(j.propertyId, current);
    }
    return map;
  }, [jobs]);

  const scheduledJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.status !== "COMPLETED")
        .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()),
    [jobs]
  );

  const completedJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "COMPLETED")
        .sort(
          (a, b) =>
            new Date(b.completedAt ?? b.scheduledDate).getTime() -
            new Date(a.completedAt ?? a.scheduledDate).getTime()
        ),
    [jobs]
  );

  const review = () => {
    if (!draft.address.trim()) {
      setError(t("client.properties.editor.addressRequired"));
      return;
    }
    setError(null);
    setConfirmOpen(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    const payload = {
      propertyId: draft.propertyId,
      name: draft.name.trim(),
      address: draft.address.trim(),
      poolType: draft.poolType.trim(),
      waterType: draft.waterType.trim(),
      sanitizerType: draft.sanitizerType.trim(),
      filterType: draft.filterType.trim(),
      poolVolumeGallons: draft.poolVolumeGallons.trim(),
      hasSpa: draft.hasSpa,
      accessInfo: draft.accessInfo.trim(),
      locationNotes: draft.locationNotes.trim(),
    };

    const res = await fetch("/api/client/properties", {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.property) {
      setSaving(false);
      setError(typeof data?.error === "string" ? data.error : t("client.properties.editor.saveFailed"));
      setSaveSuccess(false);
      return;
    }

    const p: ClientPropertyItem = {
      id: data.property.id,
      name: data.property.name ?? null,
      address: data.property.address,
      poolType: data.property.poolType ?? null,
      waterType: data.property.waterType ?? null,
      sanitizerType: data.property.sanitizerType ?? null,
      filterType: data.property.filterType ?? null,
      poolVolumeGallons: typeof data.property.poolVolumeGallons === "number" ? data.property.poolVolumeGallons : null,
      hasSpa: Boolean(data.property.hasSpa),
      accessInfo: data.property.accessInfo ?? null,
      locationNotes: data.property.locationNotes ?? null,
    };

    setProperties((curr) => (mode === "create" ? [...curr, p] : curr.map((x) => (x.id === p.id ? p : x))));
    setJobs((curr) =>
      curr.map((j) =>
        j.propertyId === p.id ? { ...j, propertyName: p.name, propertyAddress: p.address } : j
      )
    );

    setSaveSuccess(true);
    setSaving(false);
    setDraft(emptyDraft);
    setNotice(mode === "create" ? t("client.properties.editor.createdOk") : t("client.properties.editor.updatedOk"));
    if (saveSuccessTimerRef.current) {
      clearTimeout(saveSuccessTimerRef.current);
    }
    saveSuccessTimerRef.current = setTimeout(() => {
      setSaveSuccess(false);
      setEditorOpen(false);
      setConfirmOpen(false);
    }, 850);
    router.refresh();
  };

  const goJob = (jobId: string) => router.push(`/client/jobs/${jobId}`);

  const renderRows = (
    rows: ClientPropertyJob[],
    emptyLabel: string,
    useCompletedDate: boolean
  ) => {
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={99} className="px-4 py-6 text-sm text-slate-500">
            {emptyLabel}
          </td>
        </tr>
      );
    }

    return rows.map((job) => (
      <tr
        key={job.id}
        role="button"
        tabIndex={0}
        onClick={() => goJob(job.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            goJob(job.id);
          }
        }}
        className="cursor-pointer transition hover:bg-sky-50/70 focus:outline-none focus-visible:bg-sky-50/70"
      >
        <td className="px-3 py-3 text-[13px] sm:text-sm">
          {new Date(
            useCompletedDate ? job.completedAt ?? job.scheduledDate : job.scheduledDate
          ).toLocaleDateString(locale)}
        </td>
        <td className="hidden px-3 py-3 lg:table-cell">
          <span className="block max-w-[18rem] truncate" title={job.propertyAddress}>
            {job.propertyName?.trim() || job.propertyAddress}
          </span>
        </td>
        <td className="px-3 py-3 text-[13px] sm:text-sm">
          {job.type === "ON_DEMAND" ? t("jobs.type.onDemand") : t("jobs.type.routine")}
        </td>
        <td className="px-3 py-3 text-[13px] sm:text-sm">
          <span className="app-chip inline-flex items-center px-2 py-1 text-[11px]">
            {getJobStatusLabel(job.status, t)}
          </span>
        </td>
        <td className="hidden whitespace-nowrap px-3 py-3 text-right lg:table-cell">
          <span className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {job.photosCount}
          </span>
        </td>
      </tr>
    ));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("client.properties.list.title")}</h2>
            <p className="text-sm text-slate-500">{t("client.properties.list.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={openCreate} className="app-button-primary px-4 py-2 text-sm font-semibold">
              {t("client.properties.actions.create")}
            </button>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {properties.length}
            </span>
          </div>
        </div>

        {notice ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
        ) : null}

        {properties.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            {t("client.profile.noProperties")}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {properties.map((p) => {
              const stats = statsByProperty.get(p.id) ?? { scheduled: 0, completed: 0 };
              return (
                <article key={p.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {p.name?.trim() || t("client.home.recent.columns.property")}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">{p.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                        {t("client.properties.list.scheduledCount", { count: String(stats.scheduled) })}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {t("client.properties.list.completedCount", { count: String(stats.completed) })}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                      >
                        {t("common.actions.edit")}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-700">
                    <span className="font-semibold text-slate-900">{t("admin.routes.labels.poolType")}:</span>{" "}
                    {show(p.poolType)}
                    <span className="px-2 text-slate-300">•</span>
                    <span className="font-semibold text-slate-900">{t("admin.routes.labels.waterType")}:</span>{" "}
                    {show(p.waterType)}
                    <span className="px-2 text-slate-300">•</span>
                    <span className="font-semibold text-slate-900">{t("admin.routes.labels.filterType")}:</span>{" "}
                    {show(p.filterType)}
                    <span className="px-2 text-slate-300">•</span>
                    <span className="font-semibold text-slate-900">{t("admin.routes.labels.sanitizerSystem")}:</span>{" "}
                    {show(p.sanitizerType)}
                    <span className="px-2 text-slate-300">•</span>
                    <span className="font-semibold text-slate-900">{t("admin.routes.labels.poolVolume")}:</span>{" "}
                    {p.poolVolumeGallons ?? "-"}
                    <span className="px-2 text-slate-300">•</span>
                    <span className="font-semibold text-slate-900">{t("admin.customers.detail.properties.fields.spa")}:</span>{" "}
                    {p.hasSpa ? t("common.labels.yes") : t("common.labels.no")}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">{t("client.properties.history.scheduledTitle")}</h2>
        <p className="text-sm text-slate-500">{t("client.properties.history.scheduledSubtitle")}</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full min-w-full table-fixed text-left text-sm">
            <thead className="bg-[linear-gradient(120deg,#0f3b73,#0e7490)] text-[11px] uppercase tracking-[0.12em] text-sky-50">
              <tr>
                <th className="w-1/3 px-3 py-2 font-semibold lg:w-[20%]">{t("client.home.recent.columns.date")}</th>
                <th className="hidden px-3 py-2 font-semibold lg:table-cell lg:w-[28%]">{t("client.home.recent.columns.property")}</th>
                <th className="w-1/3 px-3 py-2 font-semibold lg:w-[18%]">{t("client.home.recent.columns.type")}</th>
                <th className="w-1/3 px-3 py-2 font-semibold lg:w-[18%]">{t("client.home.recent.columns.status")}</th>
                <th className="hidden px-3 py-2 text-right font-semibold lg:table-cell lg:w-[16%]">{t("client.home.recent.columns.evidence")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {renderRows(scheduledJobs, t("client.properties.history.scheduledEmpty"), false)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">{t("client.properties.history.completedTitle")}</h2>
        <p className="text-sm text-slate-500">{t("client.properties.history.completedSubtitle")}</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full min-w-full table-fixed text-left text-sm">
            <thead className="bg-[linear-gradient(120deg,#14532d,#0f766e)] text-[11px] uppercase tracking-[0.12em] text-emerald-50">
              <tr>
                <th className="w-1/3 px-3 py-2 font-semibold lg:w-[20%]">{t("client.home.recent.columns.date")}</th>
                <th className="hidden px-3 py-2 font-semibold lg:table-cell lg:w-[28%]">{t("client.home.recent.columns.property")}</th>
                <th className="w-1/3 px-3 py-2 font-semibold lg:w-[18%]">{t("client.home.recent.columns.type")}</th>
                <th className="w-1/3 px-3 py-2 font-semibold lg:w-[18%]">{t("client.home.recent.columns.status")}</th>
                <th className="hidden px-3 py-2 text-right font-semibold lg:table-cell lg:w-[16%]">{t("client.home.recent.columns.evidence")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {renderRows(completedJobs, t("client.properties.history.completedEmpty"), true)}
            </tbody>
          </table>
        </div>
      </section>

      {editorOpen ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            aria-label={t("common.actions.close")}
            onClick={closeModals}
          />
          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="modal-scroll max-h-[88vh] overflow-y-auto p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {mode === "create" ? t("client.properties.editor.createKicker") : t("client.properties.editor.editKicker")}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">
                    {mode === "create" ? t("client.properties.editor.createTitle") : t("client.properties.editor.editTitle")}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {mode === "create" ? t("client.properties.editor.createSubtitle") : t("client.properties.editor.editSubtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModals}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  aria-label={t("common.actions.close")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("admin.customers.detail.properties.fields.name")}</label>
                  <input value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))} className="app-input mt-2 w-full px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("admin.routes.labels.poolType")}</label>
                  <input value={draft.poolType} onChange={(e) => setDraft((c) => ({ ...c, poolType: e.target.value }))} className="app-input mt-2 w-full px-4 py-3 text-sm" />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("address.line1")}</label>
                <input value={draft.address} onChange={(e) => setDraft((c) => ({ ...c, address: e.target.value }))} className="app-input mt-2 w-full px-4 py-3 text-sm" required />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("admin.routes.labels.waterType")}</label>
                  <input value={draft.waterType} onChange={(e) => setDraft((c) => ({ ...c, waterType: e.target.value }))} className="app-input mt-2 w-full px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("admin.routes.labels.filterType")}</label>
                  <input value={draft.filterType} onChange={(e) => setDraft((c) => ({ ...c, filterType: e.target.value }))} className="app-input mt-2 w-full px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("admin.routes.labels.sanitizerSystem")}</label>
                  <input value={draft.sanitizerType} onChange={(e) => setDraft((c) => ({ ...c, sanitizerType: e.target.value }))} className="app-input mt-2 w-full px-4 py-3 text-sm" />
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("admin.routes.labels.poolVolume")}</label>
                  <input type="number" min={0} value={draft.poolVolumeGallons} onChange={(e) => setDraft((c) => ({ ...c, poolVolumeGallons: e.target.value }))} className="app-input mt-2 w-full px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("admin.customers.detail.properties.fields.spa")}</label>
                  <select value={draft.hasSpa ? "yes" : "no"} onChange={(e) => setDraft((c) => ({ ...c, hasSpa: e.target.value === "yes" }))} className="app-input mt-2 w-full bg-white px-4 py-3 text-sm">
                    <option value="no">{t("common.labels.no")}</option>
                    <option value="yes">{t("common.labels.yes")}</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("admin.customers.detail.properties.fields.accessInfo")}</label>
                  <textarea value={draft.accessInfo} onChange={(e) => setDraft((c) => ({ ...c, accessInfo: e.target.value }))} className="app-input mt-2 min-h-[100px] w-full px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("admin.customers.detail.properties.fields.locationNotes")}</label>
                  <textarea value={draft.locationNotes} onChange={(e) => setDraft((c) => ({ ...c, locationNotes: e.target.value }))} className="app-input mt-2 min-h-[100px] w-full px-4 py-3 text-sm" />
                </div>
              </div>

              {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={closeModals} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400">
                  {t("common.actions.cancel")}
                </button>
                <button type="button" onClick={review} className="app-button-primary px-5 py-2 text-sm font-semibold">
                  {t("client.properties.editor.review")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-[1210] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px]"
            aria-label={t("common.actions.close")}
            onClick={() => !saving && setConfirmOpen(false)}
          />
          <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t("client.properties.confirm.kicker")}</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">{t("client.properties.confirm.title")}</h3>
              <p className="mt-1 text-sm text-slate-500">{t("client.properties.confirm.subtitle")}</p>

              <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700 sm:grid-cols-2">
                <p><span className="font-semibold text-slate-900">{t("admin.customers.detail.properties.fields.name")}:</span> {show(draft.name)}</p>
                <p><span className="font-semibold text-slate-900">{t("address.line1")}:</span> {show(draft.address)}</p>
                <p><span className="font-semibold text-slate-900">{t("admin.routes.labels.poolType")}:</span> {show(draft.poolType)}</p>
                <p><span className="font-semibold text-slate-900">{t("admin.routes.labels.waterType")}:</span> {show(draft.waterType)}</p>
                <p><span className="font-semibold text-slate-900">{t("admin.routes.labels.filterType")}:</span> {show(draft.filterType)}</p>
                <p><span className="font-semibold text-slate-900">{t("admin.routes.labels.sanitizerSystem")}:</span> {show(draft.sanitizerType)}</p>
                <p><span className="font-semibold text-slate-900">{t("admin.routes.labels.poolVolume")}:</span> {show(draft.poolVolumeGallons)}</p>
                <p><span className="font-semibold text-slate-900">{t("admin.customers.detail.properties.fields.spa")}:</span> {draft.hasSpa ? t("common.labels.yes") : t("common.labels.no")}</p>
                <p><span className="font-semibold text-slate-900">{t("admin.customers.detail.properties.fields.accessInfo")}:</span> {show(draft.accessInfo)}</p>
                <p><span className="font-semibold text-slate-900">{t("admin.customers.detail.properties.fields.locationNotes")}:</span> {show(draft.locationNotes)}</p>
              </div>

              {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setConfirmOpen(false)} disabled={saving || saveSuccess} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60">
                  {t("client.properties.confirm.back")}
                </button>
                <button type="button" onClick={save} disabled={saving || saveSuccess} className="app-button-primary px-5 py-2 text-sm font-semibold disabled:opacity-60">
                  {saving
                    ? t("common.feedback.saving")
                    : saveSuccess
                      ? t("common.feedback.saved")
                      : t("client.properties.confirm.confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
