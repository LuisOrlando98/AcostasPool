"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/client";
import {
  buildCustomerJobPhotoRepositoryPrefix,
  buildTechJobPhotoFileName,
} from "@/lib/storage/paths";
import { compressImages, type CompressImageOptions } from "@/lib/ui/image-compress";

type ChecklistItem = { label?: string; completed?: boolean };

type MessageTone = "error" | "success";

type UploadPhase = "idle" | "preparing" | "uploading";

type SelectedPhoto = {
  readonly id: string;
  readonly file: File;
  readonly previewUrl: string;
};

type PhotoPreviewEntry = {
  readonly id: string;
  readonly previewUrl: string;
  readonly originalName: string;
  readonly renamedName: string;
};

const BYTES_PER_MB = 1024 * 1024;
// Keep aligned with MAX_FILE_SIZE_BYTES in src/app/api/jobs/[id]/photos/route.ts.
const MAX_PHOTO_MB = 10;
const MAX_PHOTO_BYTES = MAX_PHOTO_MB * BYTES_PER_MB;
// Camera photos (3-8 MB) shrink to a few hundred KB; see src/lib/ui/image-compress.ts.
const PHOTO_COMPRESSION: CompressImageOptions = { maxDimension: 1600, quality: 0.82 };

const buildPhotoFingerprint = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

// Object URLs are unique per call, so they double as stable React keys.
const toSelectedPhoto = (file: File): SelectedPhoto => {
  const previewUrl = URL.createObjectURL(file);
  return { id: previewUrl, file, previewUrl };
};

const revokePreview = (photo: SelectedPhoto) => URL.revokeObjectURL(photo.previewUrl);

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

function PhotoPreviewList({
  entries,
  disabled,
  onRemove,
}: {
  entries: PhotoPreviewEntry[];
  disabled: boolean;
  onRemove: (photoId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <ul className="mt-2 space-y-2 text-xs text-slate-600">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, not an asset */}
          <img
            src={entry.previewUrl}
            alt={t("tech.jobs.upload.photoPreviewAlt", { name: entry.originalName })}
            className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-white object-cover"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-slate-500">{entry.originalName}</p>
            <p className="truncate rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700">
              {entry.renamedName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            disabled={disabled}
            aria-label={t("tech.jobs.upload.removePhotoAria", { name: entry.originalName })}
            className="ui-button-ghost inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center px-3 text-xs font-semibold disabled:opacity-60"
          >
            {t("tech.jobs.upload.removePhoto")}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function TechJobUploadForm({ job }: { job: TechJobUploadData }) {
  const { t } = useI18n();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const backToRoutesRef = useRef<HTMLAnchorElement | null>(null);
  const photosRef = useRef<SelectedPhoto[]>([]);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(job.checklist);
  const [internalNotes, setInternalNotes] = useState(job.internalNotes ?? "");
  const [customerNotes, setCustomerNotes] = useState(job.customerNotes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<MessageTone>("error");
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [uploadDate] = useState(() => new Date());

  // Removals revoke their preview eagerly; the rest is revoked on unmount.
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      photosRef.current.forEach(revokePreview);
    },
    []
  );

  // After a successful upload the exit CTA receives focus (no auto-redirect).
  useEffect(() => {
    if (submitted) {
      backToRoutesRef.current?.focus();
    }
  }, [submitted]);

  const files = useMemo(() => photos.map((photo) => photo.file), [photos]);
  const loading = phase !== "idle";
  const checklistCompleted = useMemo(
    () => checklist.every((item) => Boolean(item.completed)),
    [checklist]
  );
  const isCompleted = job.status === "COMPLETED" || submitted;
  const canSubmit =
    !isCompleted && files.length > 0 && (checklist.length === 0 || checklistCompleted);
  const canCallCustomer =
    typeof job.customerPhone === "string" && job.customerPhone.trim().length > 0;
  const phoneHref = canCallCustomer
    ? `tel:${job.customerPhone?.replace(/\s+/g, "")}`
    : null;

  const photoPreviews = useMemo<PhotoPreviewEntry[]>(
    () =>
      photos.map((photo, index) => ({
        id: photo.id,
        previewUrl: photo.previewUrl,
        originalName: photo.file.name,
        renamedName: buildTechJobPhotoFileName({
          date: uploadDate,
          customerName: job.customerName,
          technicianName: job.technicianName,
          index: job.existingPhotosCount + index,
        }),
      })),
    [photos, job.customerName, job.existingPhotosCount, job.technicianName, uploadDate]
  );

  const repositoryPrefix = useMemo(
    () => buildCustomerJobPhotoRepositoryPrefix(job.customerId, uploadDate),
    [job.customerId, uploadDate]
  );

  const showError = (text: string) => {
    setMessageTone("error");
    setMessage(text);
  };

  const buildTooLargeMessage = (oversized: File[]) =>
    t("tech.jobs.upload.errors.fileTooLarge", {
      names: oversized.map((file) => file.name).join(", "),
      maxMb: MAX_PHOTO_MB,
    });

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const selected = Array.from(input.files ?? []);
    // Reset so the same photo can be picked again after being removed.
    input.value = "";
    const oversized = selected.filter((file) => file.size > MAX_PHOTO_BYTES);
    const known = new Set(photos.map((photo) => buildPhotoFingerprint(photo.file)));
    const added = selected
      .filter(
        (file) => file.size <= MAX_PHOTO_BYTES && !known.has(buildPhotoFingerprint(file))
      )
      .map(toSelectedPhoto);
    if (added.length > 0) {
      setPhotos([...photos, ...added]);
    }
    if (oversized.length > 0) {
      showError(buildTooLargeMessage(oversized));
      return;
    }
    setMessage(null);
  };

  const handleRemovePhoto = (photoId: string) => {
    const target = photos.find((photo) => photo.id === photoId);
    if (target) {
      revokePreview(target);
    }
    setPhotos(photos.filter((photo) => photo.id !== photoId));
  };

  const buildFormData = async () => {
    const uploads = await compressImages(files, PHOTO_COMPRESSION);
    const formData = new FormData();
    uploads.forEach((file) => formData.append("files", file));
    formData.append("checklist", JSON.stringify(checklist));
    if (internalNotes.trim()) {
      formData.append("internalNotes", internalNotes.trim());
    }
    if (customerNotes.trim()) {
      formData.append("customerNotes", customerNotes.trim());
    }
    return formData;
  };

  const handleSubmit = async () => {
    if (isCompleted) {
      showError(t("tech.jobs.upload.errors.completed"));
      return;
    }
    if (files.length === 0) {
      showError(t("tech.jobs.upload.errors.file"));
      return;
    }
    if (checklist.length > 0 && !checklistCompleted) {
      showError(t("tech.jobs.upload.errors.checklist"));
      return;
    }
    const oversized = files.filter((file) => file.size > MAX_PHOTO_BYTES);
    if (oversized.length > 0) {
      showError(buildTooLargeMessage(oversized));
      return;
    }

    setPhase("preparing");
    setMessage(null);
    try {
      const body = await buildFormData();
      setPhase("uploading");
      const res = await fetch(`/api/jobs/${job.id}/photos`, {
        method: "POST",
        body,
      });

      if (!res.ok) {
        showError(t("tech.jobs.upload.errors.submit"));
        return;
      }

      setMessageTone("success");
      setMessage(t("tech.jobs.upload.success"));
      setSubmitted(true);
    } catch {
      // Files, notes and checklist stay in state so the technician can retry as-is.
      showError(t("tech.jobs.upload.errors.network"));
    } finally {
      setPhase("idle");
    }
  };

  const submitLabel =
    phase === "preparing"
      ? t("tech.jobs.upload.preparingPhotos")
      : phase === "uploading"
        ? t("tech.jobs.upload.loading")
        : t("tech.jobs.upload.submit");

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
          <Link
            href="/tech"
            className="ui-button-ghost inline-flex min-h-11 items-center px-3 py-2 text-xs font-semibold"
          >
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
              className="ui-button-ghost inline-flex min-h-11 items-center justify-center px-3 py-2 text-xs font-semibold"
            >
              {t("tech.home.route.openMap")}
            </a>
            {canCallCustomer ? (
              <a
                href={phoneHref ?? "#"}
                className="ui-button-ghost inline-flex min-h-11 items-center justify-center px-3 py-2 text-xs font-semibold"
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
                className="ui-button-ghost inline-flex min-h-11 items-center px-3 py-1 text-xs font-semibold"
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
                className="ui-button-ghost inline-flex min-h-11 items-center px-3 py-1 text-xs font-semibold"
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
                className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={loading}
              className="app-button-secondary inline-flex min-h-11 w-full items-center justify-center px-4 py-3 text-xs font-semibold disabled:opacity-70"
            >
              {t("tech.jobs.upload.takePhotoCamera")}
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={loading}
              className="app-button-secondary inline-flex min-h-11 w-full items-center justify-center px-4 py-3 text-xs font-semibold disabled:opacity-70"
            >
              {t("tech.jobs.upload.chooseFromGallery")}
            </button>
          </div>
          {/* Two hidden inputs: `capture` forces the camera on most phones, the other one opens the gallery. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFilesSelected}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />

          <p className="text-[11px] text-slate-500">
            {t("tech.jobs.upload.photoCount", { count: files.length })}
            {" · "}
            {t("tech.jobs.upload.photoMaxSize", { maxMb: MAX_PHOTO_MB })}
          </p>

          {photoPreviews.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {t("tech.jobs.upload.renamePreviewTitle")}
              </p>
              <PhotoPreviewList
                entries={photoPreviews}
                disabled={loading || isCompleted}
                onRemove={handleRemovePhoto}
              />
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
              className="app-input mt-2 w-full bg-white px-4 py-3 text-base sm:text-sm"
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
              className="app-input mt-2 w-full bg-white px-4 py-3 text-base sm:text-sm"
              placeholder={t("tech.jobs.upload.customerNotesPlaceholder")}
            />
          </div>
        </div>
      </div>

      {message || isCompleted ? (
        <div className="app-card p-6 shadow-contrast">
          {message ? (
            <div
              role={messageTone === "error" ? "alert" : "status"}
              className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                messageTone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {message}
            </div>
          ) : null}
          {isCompleted ? (
            <p className="text-xs text-slate-500">{t("tech.jobs.upload.completedNote")}</p>
          ) : null}
        </div>
      ) : null}

      <div
        className="sticky bottom-2 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {!canSubmit && !isCompleted ? (
          <p className="mb-2 text-[11px] text-slate-500">
            {files.length === 0
              ? t("tech.jobs.upload.quickHintPhoto")
              : checklist.length > 0 && !checklistCompleted
                ? t("tech.jobs.upload.quickHintChecklist")
                : t("tech.jobs.upload.quickHintReady")}
          </p>
        ) : null}
        {submitted ? (
          <Link
            ref={backToRoutesRef}
            href="/tech"
            className="app-button-primary inline-flex min-h-11 w-full items-center justify-center px-5 py-3 text-sm font-semibold"
          >
            {t("tech.jobs.upload.backToRoutes")}
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || isCompleted || !canSubmit}
            className="app-button-primary min-h-11 w-full px-5 py-3 text-sm font-semibold disabled:opacity-70"
          >
            {submitLabel}
          </button>
        )}
      </div>
    </section>
  );
}
