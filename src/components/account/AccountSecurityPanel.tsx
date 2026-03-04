"use client";

import { useState } from "react";
import ResetLinkButton from "@/components/account/ResetLinkButton";
import { useI18n } from "@/i18n/client";

type AccountSecurityPanelProps = {
  initialEmail2faEnabled: boolean;
};

export default function AccountSecurityPanel({
  initialEmail2faEnabled,
}: AccountSecurityPanelProps) {
  const { t } = useI18n();
  const [email2faEnabled, setEmail2faEnabled] = useState(initialEmail2faEnabled);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle2fa = async () => {
    if (saving) {
      return;
    }
    const nextValue = !email2faEnabled;
    setSaving(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/account/security", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email2faEnabled: nextValue }),
    }).catch(() => null);

    if (!response?.ok) {
      setSaving(false);
      setError(t("client.profile.security.twoFaError"));
      return;
    }

    setEmail2faEnabled(nextValue);
    setSaving(false);
    setNotice(
      nextValue
        ? t("client.profile.security.twoFaEnabled")
        : t("client.profile.security.twoFaDisabled")
    );
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">
        {t("client.profile.security.title")}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {t("client.profile.security.subtitle")}
      </p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {t("client.profile.security.twoFaTitle")}
            </p>
            <p className="text-xs text-slate-500">
              {t("client.profile.security.twoFaSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={toggle2fa}
            disabled={saving}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
              email2faEnabled ? "bg-emerald-500" : "bg-slate-300"
            } ${saving ? "opacity-70" : ""}`}
            aria-label={t("client.profile.security.twoFaTitle")}
            aria-pressed={email2faEnabled}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                email2faEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {notice ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <ResetLinkButton
          submitLabel={t("client.profile.security.reset.submit")}
          loadingLabel={t("client.profile.security.reset.loading")}
          sentLabel={t("client.profile.security.reset.sent")}
          errorLabel={t("client.profile.security.reset.error")}
          buttonClassName="w-full justify-center"
        />
      </div>
    </div>
  );
}
