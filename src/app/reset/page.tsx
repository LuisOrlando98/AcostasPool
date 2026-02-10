"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      setMessage(t("auth.reset.errors.token"));
      return;
    }
    if (password.length < 6) {
      setMessage(t("auth.reset.errors.length"));
      return;
    }
    if (password !== confirm) {
      setMessage(t("auth.reset.errors.mismatch"));
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? t("auth.reset.errors.generic"));
      setLoading(false);
      return;
    }
    setMessage(t("auth.reset.success"));
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-12">
        <div className="app-card w-full p-8 shadow-contrast">
          <h1 className="text-2xl font-semibold">{t("auth.reset.title")}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("auth.reset.subtitle")}
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("auth.reset.token")}
              </label>
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="app-input mt-2 w-full px-4 py-3 text-sm"
                placeholder={t("auth.reset.tokenPlaceholder")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("auth.reset.newPassword")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="app-input mt-2 w-full px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("auth.reset.confirmPassword")}
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="app-input mt-2 w-full px-4 py-3 text-sm"
              />
            </div>
            {message ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {message}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="app-button-primary w-full px-4 py-3 text-sm font-semibold disabled:opacity-70"
            >
              {loading ? t("auth.reset.loading") : t("auth.reset.submit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
