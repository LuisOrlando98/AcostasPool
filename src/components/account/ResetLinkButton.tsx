"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

export default function ResetLinkButton() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setLoading(true);
    setSent(false);
    setError(null);
    const res = await fetch("/api/auth/reset-link", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? t("account.resetLink.error"));
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleSend}
        disabled={loading}
        className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? t("account.resetLink.loading") : t("account.resetLink.submit")}
      </button>
      {sent ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {t("account.resetLink.sent")}
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </div>
  );
}
