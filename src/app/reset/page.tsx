"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(false);
  const hasToken = token.trim().length > 0;

  const handleResetPassword = async () => {
    if (!token) {
      setMessage(t("auth.reset.errors.token"));
      setMessageTone("error");
      return;
    }
    if (password.length < 10) {
      setMessage(t("auth.reset.errors.length"));
      setMessageTone("error");
      return;
    }
    if (password !== confirm) {
      setMessage(t("auth.reset.errors.mismatch"));
      setMessageTone("error");
      return;
    }
    setLoading(true);
    setMessage(null);
    setMessageTone(null);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? t("auth.reset.errors.generic"));
      setMessageTone("error");
      setLoading(false);
      return;
    }
    setMessage(t("auth.reset.success"));
    setMessageTone("success");
    setLoading(false);
  };

  const handleRequestReset = async () => {
    if (!email.trim()) {
      setMessage(t("auth.reset.errors.email"));
      setMessageTone("error");
      return;
    }
    setLoading(true);
    setMessage(null);
    setMessageTone(null);

    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? t("auth.reset.errors.generic"));
      setMessageTone("error");
      setLoading(false);
      return;
    }

    setMessage(t("auth.reset.requestSent"));
    setMessageTone("success");
    setLoading(false);
  };

  return (
    <div className="pool-login-shell min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-center lg:justify-between">
        <section className="w-full max-w-xl space-y-6">
          <div className="pool-login-badge inline-flex items-center gap-2">
            {t("auth.login.kicker")}
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {t("auth.reset.title")}{" "}
            <span className="text-[#30bced]">{t("app.name")}</span>.
          </h1>
          <p className="text-sm text-white/70 sm:text-base">
            {hasToken ? t("auth.reset.subtitle") : t("auth.reset.requestSubtitle")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="pool-login-metric">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                {t("auth.login.metrics.security.kicker")}
              </p>
              <p className="mt-2 text-sm font-semibold">{t("auth.login.metrics.security.title")}</p>
              <p className="mt-1 text-xs text-white/60">{t("auth.login.metrics.security.desc")}</p>
            </div>
            <div className="pool-login-metric">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                {t("auth.login.metrics.quality.kicker")}
              </p>
              <p className="mt-2 text-sm font-semibold">{t("auth.login.metrics.quality.title")}</p>
              <p className="mt-1 text-xs text-white/60">{t("auth.login.metrics.quality.desc")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            <Link href="/login" className="pool-login-link">
              {t("auth.login.title")}
            </Link>
            <Link href="/" className="pool-login-link">
              {t("auth.login.publicLink")}
            </Link>
          </div>
        </section>

        <section className="pool-login-card w-full max-w-md p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
            {t("app.name")}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#30bced]">{t("auth.reset.title")}</h2>

          <div className="mt-6 space-y-4">
            {hasToken ? (
              <>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    {t("auth.reset.confirmPassword")}
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  {t("common.labels.email")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="app-input mt-2 w-full px-4 py-3 text-sm"
                  placeholder={t("auth.login.emailPlaceholder")}
                />
              </div>
            )}
            {message ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  messageTone === "success"
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                    : "border-rose-400/40 bg-rose-500/15 text-rose-100"
                }`}
              >
                {message}
              </div>
            ) : null}
            <button
              type="button"
              onClick={hasToken ? handleResetPassword : handleRequestReset}
              disabled={loading}
              className="w-full rounded-full bg-[#30bced] px-4 py-3 text-sm font-semibold text-[#07182b] transition hover:bg-[#52d6ff] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading
                ? t("auth.reset.loading")
                : hasToken
                  ? t("auth.reset.submit")
                  : t("auth.reset.requestSubmit")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
