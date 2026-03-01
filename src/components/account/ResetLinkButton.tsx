"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

type ResetLinkButtonProps = {
  submitLabel?: string;
  loadingLabel?: string;
  sentLabel?: string;
  errorLabel?: string;
};

export default function ResetLinkButton({
  submitLabel,
  loadingLabel,
  sentLabel,
  errorLabel,
}: ResetLinkButtonProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedSubmitLabel = submitLabel ?? t("account.resetLink.submit");
  const resolvedLoadingLabel = loadingLabel ?? t("account.resetLink.loading");
  const resolvedSentLabel = sentLabel ?? t("account.resetLink.sent");
  const resolvedErrorLabel = errorLabel ?? t("account.resetLink.error");

  const handleSend = async () => {
    setLoading(true);
    setSent(false);
    setError(null);
    const res = await fetch("/api/auth/reset-link", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? resolvedErrorLabel);
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
        {loading ? resolvedLoadingLabel : resolvedSubmitLabel}
      </button>
      {sent ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {resolvedSentLabel}
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </div>
  );
}
