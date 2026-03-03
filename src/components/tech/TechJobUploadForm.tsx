"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/client";
import {
  buildCustomerJobPhotoRepositoryPrefix,
  buildTechJobPhotoFileName,
} from "@/lib/storage/paths";

type ChecklistItem = { label?: string; completed?: boolean };

type TechJobUploadData = {
  id: string;
  customerId: string;
  customerName: string;
  technicianName: string;
  existingPhotosCount: number;
  customerPhone?: string | null;
  propertyAddress: string;
  scheduledTime: string;
  serviceLabel: string;
  priorityLabel: string;
  priorityTone: "warning" | "danger";
  typeLabel: string;
  accessInfo?: string | null;
  checklist: ChecklistItem[];
  internalNotes?: string | null;
  customerNotes?: string | null;
  status: string;
};

export default function TechJobUploadForm({ job }: { job: TechJobUploadData }) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(job.checklist);
  const [internalNotes, setInternalNotes] = useState(job.internalNotes ?? "");
  const [customerNotes, setCustomerNotes] = useState(job.customerNotes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadDate] = useState(() => new Date());

  const checklistCompleted = useMemo(
    () => checklist.every((item) => Boolean(item.completed)),
    [checklist]
  );
  const isCompleted = job.status === "COMPLETED";
  const canSubmit =
    !isCompleted && files.length > 0 && (checklist.length === 0 || checklistCompleted);
  const canCallCustomer =
    typeof job.customerPhone === "string" && job.customerPhone.trim().length > 0;
  const phoneHref = canCallCustomer
    ? `tel:${job.customerPhone?.replace(/\s+/g, "")}`
    : null;

  const renamedFilePreview = useMemo(
    () =>
      files.map((file, index) => ({
        originalName: file.name,
        renamedName: buildTechJobPhotoFileName({
          date: uploadDate,
          customerName: job.customerName,
          technicianName: job.technicianName,
          index: job.existingPhotosCount + index,
        }),
      })),
    [files, job.customerName, job.existingPhotosCount, job.technicianName, uploadDate]
  );

  const repositoryPrefix = useMemo(
    () => buildCustomerJobPhotoRepositoryPrefix(job.customerId, uploadDate),
    [job.customerId, uploadDate]
  );

  const handleSubmit = async () => {
    if (isCompleted) {
      setMessage(t("tech.jobs.upload.errors.completed"));
      return;
    }
    if (files.length === 0) {
      setMessage(t("tech.jobs.upload.errors.file"));
      return;
    }
    if (checklist.length > 0 && !checklistCompleted) {
      setMessage(t("tech.jobs.upload.errors.checklist"));
      return;
    }

    setLoading(true);
    setMessage(null);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("checklist", JSON.stringify(checklist));
    if (internalNotes.trim()) {
      formData.append("internalNotes", internalNotes.trim());
    }
    if (customerNotes.trim()) {
      formData.append("customerNotes", customerNotes.trim());
    }

    const res = await fetch(`/api/jobs/${job.id}/photos`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setMessage(t("tech.jobs.upload.errors.submit"));
      setLoading(false);
      return;
    }

    setMessage(t("tech.jobs.upload.success"));
    setLoading(false);
    window.setTimeout(() => {
      window.location.href = "/tech";
    }, 900);
  };

  return (
    <section className="space-y-6">
      <div className="app-card p-6 shadow-contrast">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t("tech.jobs.upload.kicker")}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              {t("tech.jobs.upload.summaryTitle")}
            </h2>
          </div>
          <Link href="/tech" className="ui-button-ghost px-3 py-2 text-xs font-semibold">
            {t("tech.jobs.upload.back")}
          </Link>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p className="text-base font-semibold text-slate-900">{job.customerName}</p>
          <p className="text-sm text-slate-500">{job.propertyAddress}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="app-chip px-2 py-1 text-xs" data-tone="info">
              {job.serviceLabel}
            </span>
            <span className="app-chip px-2 py-1 text-xs" data-tone={job.priorityTone}>
              {job.priorityLabel}
            </span>
            <span className="app-chip px-2 py-1 text-xs" data-tone="info">
              {job.typeLabel}
            </span>
            <span className="app-chip px-2 py-1 text-xs" data-tone="success">
              {job.scheduledTime}
            </span>
          </div>
          {job.accessInfo ? (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {job.accessInfo}
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                job.propertyAddress
              )}`}
              target="_blank"
              rel="noreferrer"
              className="ui-button-ghost inline-flex items-center justify-center px-3 py-2 text-xs font-semibold"
            >
              {t("tech.home.route.openMap")}
            </a>
            {canCallCustomer ? (
              <a
                href={phoneHref ?? "#"}
                className="ui-button-ghost inline-flex items-center justify-center px-3 py-2 text-xs font-semibold"
              >
                {t("tech.home.route.call")}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="app-card p-6 shadow-contrast">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("tech.jobs.upload.checklistTitle")}</h2>
          {checklist.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setChecklist((items) =>
                    items.map((item) => ({ ...item, completed: true }))
                  )
                }
                className="ui-button-ghost px-3 py-1 text-xs font-semibold"
              >
                {t("tech.jobs.upload.checklistAll")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setChecklist((items) =>
                    items.map((item) => ({ ...item, completed: false }))
                  )
                }
                className="ui-button-ghost px-3 py-1 text-xs font-semibold"
              >
                {t("tech.jobs.upload.checklistClear")}
              </button>
            </div>
          ) : null}
        </div>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {checklist.length === 0 ? (
            <p className="text-sm text-slate-500">{t("tech.jobs.upload.checklistEmpty")}</p>
          ) : (
            checklist.map((item, index) => (
              <label
                key={`${item.label ?? "item"}-${index}`}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={Boolean(item.completed)}
                  onChange={() =>
                    setChecklist((items) =>
                      items.map((entry, idx) =>
                        idx === index
                          ? { ...entry, completed: !entry.completed }
                          : entry
                      )
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className={item.completed ? "line-through text-slate-400" : ""}>
                  {item.label ?? t("tech.jobs.upload.checklistItem")}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="app-card p-6 shadow-contrast">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("tech.jobs.upload.photosTitle")}</h2>
          <span className="text-xs text-slate-400">{t("tech.jobs.upload.photosRequired")}</span>
        </div>
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="app-button-secondary w-full px-4 py-3 text-xs font-semibold"
          >
            {t("tech.jobs.upload.takePhoto")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="app-input w-full bg-white px-4 py-3 text-sm"
          />

          <p className="text-[11px] text-slate-500">
            {t("tech.jobs.upload.photoCount", { count: files.length })}
          </p>

          {renamedFilePreview.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {t("tech.jobs.upload.renamePreviewTitle")}
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                {renamedFilePreview.map((entry, index) => (
                  <li key={`${entry.originalName}-${index}`} className="space-y-0.5">
                    <p className="truncate text-slate-500">{entry.originalName}</p>
                    <p className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700">
                      {entry.renamedName}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                {t("tech.jobs.upload.repositoryPathLabel")}{" "}
                <span className="font-semibold text-slate-700">{repositoryPrefix}</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {t("tech.jobs.upload.repositoryAdminOnly")}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="app-card p-6 shadow-contrast">
        <h2 className="text-lg font-semibold">{t("tech.jobs.upload.notesTitle")}</h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("tech.jobs.upload.internalNotes")}
            </label>
            <textarea
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              rows={3}
              className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
              placeholder={t("tech.jobs.upload.internalNotesPlaceholder")}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("tech.jobs.upload.customerNotes")}
            </label>
            <textarea
              value={customerNotes}
              onChange={(event) => setCustomerNotes(event.target.value)}
              rows={3}
              className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
              placeholder={t("tech.jobs.upload.customerNotesPlaceholder")}
            />
          </div>
        </div>
      </div>

      {message || isCompleted ? (
        <div className="app-card p-6 shadow-contrast">
          {message ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {message}
            </div>
          ) : null}
          {isCompleted ? (
            <p className="text-xs text-slate-500">{t("tech.jobs.upload.completedNote")}</p>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-2 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        {!canSubmit && !isCompleted ? (
          <p className="mb-2 text-[11px] text-slate-500">
            {files.length === 0
              ? t("tech.jobs.upload.quickHintPhoto")
              : checklist.length > 0 && !checklistCompleted
                ? t("tech.jobs.upload.quickHintChecklist")
                : t("tech.jobs.upload.quickHintReady")}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || isCompleted || !canSubmit}
          className="app-button-primary w-full px-5 py-3 text-sm font-semibold disabled:opacity-70"
        >
          {loading ? t("tech.jobs.upload.loading") : t("tech.jobs.upload.submit")}
        </button>
      </div>
    </section>
  );
}
