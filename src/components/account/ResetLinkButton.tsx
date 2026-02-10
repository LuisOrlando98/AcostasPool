"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

export default function ResetLinkButton() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/reset-link", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? t("account.resetLink.error"));
      setLoading(false);
      return;
    }
    setLink(data.resetLink ?? null);
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? t("account.resetLink.loading") : t("account.resetLink.submit")}
      </button>
      {link ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="break-all">{link}</p>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-2 text-xs font-semibold text-slate-700"
          >
            {t("account.resetLink.copy")}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </div>
  );
}
