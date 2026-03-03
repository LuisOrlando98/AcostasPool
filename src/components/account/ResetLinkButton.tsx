"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

type ResetLinkButtonProps = {
  submitLabel?: string;
  loadingLabel?: string;
  sentLabel?: string;
  errorLabel?: string;
  buttonClassName?: string;
};

export default function ResetLinkButton({
  submitLabel,
  loadingLabel,
  sentLabel,
  errorLabel,
  buttonClassName,
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
        className={`app-button-secondary inline-flex min-h-10 items-center px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60 ${buttonClassName ?? ""}`}
      >
        {loading ? resolvedLoadingLabel : resolvedSubmitLabel}
      </button>
      {sent ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {resolvedSentLabel}
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
