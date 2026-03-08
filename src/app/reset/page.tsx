"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LANDING_LOCALE_STORAGE_KEY } from "@/components/landing/preferences";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE } from "@/i18n/config";

export default function ResetPasswordPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();
  const currentYear = new Date().getFullYear();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(false);
  const [switchingLocale, setSwitchingLocale] = useState(false);
  const hasToken = token.trim().length > 0;

  const legalLinks = [
    {
      href: "/legal/terms-of-service",
      en: "Terms of Service",
      es: "Terminos de Servicio",
      shortEn: "Terms",
      shortEs: "Terminos",
    },
    {
      href: "/legal/privacy-policy",
      en: "Privacy Policy",
      es: "Politica de Privacidad",
      shortEn: "Privacy",
      shortEs: "Privacidad",
    },
    {
      href: "/legal/payment-cancellation-policy",
      en: "Payment & Cancellation",
      es: "Pago y Cancelacion",
      shortEn: "Payments",
      shortEs: "Pagos",
    },
    {
      href: "/legal/disclaimer-limitation-of-liability",
      en: "Disclaimer & Liability",
      es: "Descargo y Responsabilidad",
      shortEn: "Liability",
      shortEs: "Responsabilidad",
    },
    {
      href: "/legal/cookie-notice",
      en: "Cookie Notice",
      es: "Aviso de Cookies",
      shortEn: "Cookies",
      shortEs: "Cookies",
    },
  ] as const;

  const handleLocaleChange = (nextLocale: "en" | "es") => {
    if (nextLocale === locale) {
      return;
    }

    setSwitchingLocale(true);
    window.localStorage.setItem(LANDING_LOCALE_STORAGE_KEY, nextLocale);
    const secureCookie =
      window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=2592000; samesite=lax${secureCookie}`;
    window.location.reload();
  };

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
    window.setTimeout(() => {
      router.push("/login?reset=success");
      router.refresh();
    }, 1200);
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasToken) {
      void handleResetPassword();
      return;
    }
    void handleRequestReset();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#d9f2ff,_#f6f7fb_48%,_#ecf2f8)] text-slate-900">
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(2,132,199,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(2,132,199,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-12">
        <div className="mb-5 flex flex-nowrap items-center justify-between gap-2 sm:mb-6">
          <div className="app-chip inline-flex min-w-0 flex-1 items-center truncate whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] sm:px-4 sm:text-[11px] sm:tracking-[0.18em]">
            {t("auth.login.kicker")}
          </div>
          <div className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white/90 p-1 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => handleLocaleChange("en")}
              className={`rounded-full px-3 py-1 transition ${
                locale === "en"
                  ? "bg-sky-500 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              disabled={switchingLocale}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => handleLocaleChange("es")}
              className={`rounded-full px-3 py-1 transition ${
                locale === "es"
                  ? "bg-sky-500 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              disabled={switchingLocale}
            >
              ES
            </button>
          </div>
        </div>

        <div className="flex w-full flex-1 flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <section className="order-2 w-full max-w-xl lg:order-1">
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              {t("auth.reset.title")} <span className="text-sky-600">{t("app.name")}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {hasToken ? t("auth.reset.subtitle") : t("auth.reset.requestSubtitle")}
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <article className="app-card p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">
                  {t("auth.login.metrics.security.kicker")}
                </p>
                <p className="mt-2 text-xs font-semibold leading-4 text-slate-900 sm:text-sm">
                  {t("auth.login.metrics.security.title")}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-600 sm:text-xs">
                  {t("auth.login.metrics.security.desc")}
                </p>
              </article>
              <article className="app-card p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">
                  {t("auth.login.metrics.quality.kicker")}
                </p>
                <p className="mt-2 text-xs font-semibold leading-4 text-slate-900 sm:text-sm">
                  {t("auth.login.metrics.quality.title")}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-600 sm:text-xs">
                  {t("auth.login.metrics.quality.desc")}
                </p>
              </article>
              <article className="app-card p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">
                  {t("auth.login.metrics.routes.kicker")}
                </p>
                <p className="mt-2 text-xs font-semibold leading-4 text-slate-900 sm:text-sm">
                  {t("auth.login.metrics.routes.title")}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-600 sm:text-xs">
                  {t("auth.login.metrics.routes.desc")}
                </p>
              </article>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.14em]">
              <Link href="/login" className="text-sky-700 hover:text-sky-800">
                {t("auth.login.title")}
              </Link>
              <Link href="/" className="text-sky-700 hover:text-sky-800">
                {t("auth.login.publicLink")}
              </Link>
            </div>
          </section>

          <section className="order-1 app-card w-full max-w-md p-6 sm:p-8 lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t("app.name")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{t("auth.reset.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {hasToken ? t("auth.reset.subtitle") : t("auth.reset.requestSubtitle")}
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {hasToken ? (
                <>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-rose-300 bg-rose-50 text-rose-700"
                  }`}
                >
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="app-button-primary w-full px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading
                  ? t("auth.reset.loading")
                  : hasToken
                    ? t("auth.reset.submit")
                    : t("auth.reset.requestSubmit")}
              </button>
            </form>
          </section>
        </div>

        <div className="mt-8 border-t border-slate-200/80 pt-3">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Legal
          </p>
          <nav
            aria-label={locale === "es" ? "Enlaces legales" : "Legal links"}
            className="mx-auto mt-2 max-w-3xl rounded-2xl border border-sky-200/70 bg-[linear-gradient(135deg,rgba(4,36,58,0.95),rgba(5,68,96,0.88))] px-3 py-2"
          >
            <ul className="flex flex-wrap items-center justify-center gap-y-1 text-center">
              {legalLinks.map((item, index) => (
                <li key={item.href} className="inline-flex items-center">
                  <a
                    href={item.href}
                    className="px-2 text-[10px] font-medium text-sky-50/92 transition hover:text-white sm:text-[11px]"
                  >
                    <span className="sm:hidden">{locale === "es" ? item.shortEs : item.shortEn}</span>
                    <span className="hidden sm:inline">{locale === "es" ? item.es : item.en}</span>
                  </a>
                  {index < legalLinks.length - 1 ? (
                    <span aria-hidden="true" className="px-1 text-[10px] text-sky-100/55">
                      |
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
          <p className="mt-4 text-center text-[11px] text-slate-500">
            Copyright {currentYear} AcostasPool.{" "}
            {locale === "es" ? "Todos los derechos reservados." : "All rights reserved."}
          </p>
        </div>
      </div>
    </div>
  );
}
