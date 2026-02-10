"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { getAssetUrl } from "@/lib/assets";

type AvatarUploadProps = {
  avatarUrl?: string | null;
};

export default function AvatarUpload({ avatarUrl }: AvatarUploadProps) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    avatarUrl ? getAssetUrl(avatarUrl) : null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      setMessage(t("account.avatar.errors.file"));
      return;
    }
    setLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/account/avatar", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? t("account.avatar.errors.upload"));
      setLoading(false);
      return;
    }
    setPreview(data.avatarUrl ? getAssetUrl(data.avatarUrl) : preview);
    setMessage(t("account.avatar.success"));
    setLoading(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
        {preview ? (
          <img
            src={preview}
            alt={t("account.avatar.alt")}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
            {t("account.avatar.empty")}
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2">
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading ? t("account.avatar.loading") : t("account.avatar.submit")}
          </button>
          {message ? <span className="text-xs text-slate-500">{message}</span> : null}
        </div>
      </div>
    </div>
  );
}
