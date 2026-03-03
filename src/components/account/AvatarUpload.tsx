"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useI18n } from "@/i18n/client";
import { getAssetUrl } from "@/lib/assets";

type AvatarUploadProps = {
  avatarUrl?: string | null;
};

const MAX_AVATAR_SIDE = 700;
const SUPPORTED_ACCEPT =
  ".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp";
const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function baseNameWithoutExtension(fileName: string) {
  const clean = fileName.trim();
  const dotIndex = clean.lastIndexOf(".");
  if (dotIndex === -1) return clean || "avatar";
  const base = clean.slice(0, dotIndex).trim();
  return base || "avatar";
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return fileName.slice(dotIndex + 1).trim().toLowerCase();
}

function isSupportedImageFile(file: File) {
  const mimeType = (file.type || "").toLowerCase();
  if (SUPPORTED_MIME_TYPES.has(mimeType)) {
    return true;
  }
  return SUPPORTED_EXTENSIONS.has(getFileExtension(file.name));
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function outputMimeType(inputMimeType: string) {
  if (inputMimeType === "image/png") return "image/png";
  if (inputMimeType === "image/webp") return "image/webp";
  if (inputMimeType === "image/jpeg") return "image/jpeg";
  if (inputMimeType === "image/gif") return "image/jpeg";
  return "image/jpeg";
}

function loadImageFromObjectUrl(objectUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode image"));
    image.src = objectUrl;
  });
}

async function normalizeAvatarFile(file: File) {
  if (!isSupportedImageFile(file)) {
    throw new Error("Not an image");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const sourceSide = Math.min(sourceWidth, sourceHeight);
    const outputSide = Math.min(MAX_AVATAR_SIDE, sourceSide);
    const sourceX = Math.floor((sourceWidth - sourceSide) / 2);
    const sourceY = Math.floor((sourceHeight - sourceSide) / 2);
    const mimeType = outputMimeType(file.type);

    const canvas = document.createElement("canvas");
    canvas.width = outputSide;
    canvas.height = outputSide;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas not available");
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSide,
      sourceSide,
      0,
      0,
      outputSide,
      outputSide
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("Unable to encode image"));
            return;
          }
          resolve(result);
        },
        mimeType,
        mimeType === "image/png" ? undefined : 0.9
      );
    });

    const extension = extensionForMimeType(mimeType);
    const outputName = `${baseNameWithoutExtension(file.name)}.${extension}`;
    return new File([blob], outputName, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function AvatarUpload({ avatarUrl }: AvatarUploadProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [savedPreview, setSavedPreview] = useState<string | null>(
    avatarUrl ? getAssetUrl(avatarUrl) : null
  );
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "error" | "success">(
    "neutral"
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const updateSelectedFile = (nextFile: File | null) => {
    setFile(nextFile);
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    if (!nextFile) {
      setSelectedPreview(null);
      return;
    }
    const nextPreview = URL.createObjectURL(nextFile);
    previewObjectUrlRef.current = nextPreview;
    setSelectedPreview(nextPreview);
  };

  const handlePick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (nextFile && !isSupportedImageFile(nextFile)) {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      updateSelectedFile(null);
      setMessageTone("error");
      setMessage(t("account.avatar.errors.format"));
      return;
    }
    updateSelectedFile(nextFile);
    setMessage(null);
    setMessageTone("neutral");
  };

  const handleSubmit = async () => {
    if (!file) {
      setMessageTone("error");
      setMessage(t("account.avatar.errors.file"));
      return;
    }
    if (!isSupportedImageFile(file)) {
      setMessageTone("error");
      setMessage(t("account.avatar.errors.format"));
      return;
    }

    setLoading(true);
    setMessage(null);
    setMessageTone("neutral");

    let normalizedFile: File;
    try {
      normalizedFile = await normalizeAvatarFile(file);
    } catch {
      setMessageTone("error");
      setMessage(t("account.avatar.errors.normalize"));
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", normalizedFile);

    try {
      const res = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessageTone("error");
        if (res.status === 415) {
          setMessage(t("account.avatar.errors.format"));
        } else {
          setMessage(data.error ?? t("account.avatar.errors.upload"));
        }
        return;
      }

      setSavedPreview(
        data.avatarUrl ? `${getAssetUrl(data.avatarUrl)}?v=${Date.now()}` : null
      );
      updateSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setMessageTone("success");
      setMessage(t("account.avatar.success"));
    } finally {
      setLoading(false);
    }
  };

  const preview = selectedPreview ?? savedPreview;
  const hasFile = Boolean(file);
  const messageClass =
    messageTone === "error"
      ? "text-rose-600"
      : messageTone === "success"
      ? "text-emerald-600"
      : "text-slate-500";

  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3">
      <div className="flex justify-center">
        <div className="h-28 w-28 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm sm:h-32 sm:w-32">
          {preview ? (
            <img
              src={preview}
              alt={t("account.avatar.alt")}
              className="h-full w-full object-cover"
              onError={() => {
                if (selectedPreview) {
                  updateSelectedFile(null);
                  setMessageTone("error");
                  setMessage(t("account.avatar.errors.preview"));
                  return;
                }
                setSavedPreview(null);
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs font-medium text-slate-500">
              {t("account.avatar.empty")}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_ACCEPT}
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="text-xs font-medium text-slate-700">{t("account.avatar.formats")}</p>

        {hasFile ? (
          <p className="mt-1 truncate text-[11px] text-slate-500">
            {t("account.avatar.selected", {
              name: file?.name ?? "",
              size: file ? formatFileSize(file.size) : "",
            })}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePick}
            disabled={loading}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {hasFile ? t("account.avatar.change") : t("account.avatar.choose")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !hasFile}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading ? t("account.avatar.loading") : t("account.avatar.submit")}
          </button>
        </div>

        {message ? <p className={`mt-2 text-xs ${messageClass}`}>{message}</p> : null}
      </div>
    </div>
  );
}
