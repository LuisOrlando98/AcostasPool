"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { ROLE_REDIRECTS } from "@/lib/auth/config";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE } from "@/i18n/config";
import { LANDING_LOCALE_STORAGE_KEY } from "@/components/landing/preferences";

type LoginResponse = {
  ok?: boolean;
  role?: keyof typeof ROLE_REDIRECTS;
  error?: string;
};

type PasswordCredentialCtor = new (form: HTMLFormElement) => Credential;

export default function LoginPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchingLocale, setSwitchingLocale] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleLocaleChange = (nextLocale: "en" | "es") => {
    if (nextLocale === locale) {
      return;
    }

    setSwitchingLocale(true);
    window.localStorage.setItem(LANDING_LOCALE_STORAGE_KEY, nextLocale);
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=2592000`;
    window.location.reload();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, remember }),
    });

    const data = (await res.json().catch(() => ({}))) as LoginResponse;

    if (!res.ok) {
      setError(data.error ?? t("auth.login.error"));
      setLoading(false);
      return;
    }

    if (formRef.current && typeof window !== "undefined") {
      const PasswordCredentialCtor = (
        window as Window & { PasswordCredential?: PasswordCredentialCtor }
      ).PasswordCredential;
      if (PasswordCredentialCtor && navigator.credentials?.store) {
        try {
          const credential = new PasswordCredentialCtor(formRef.current);
          await navigator.credentials.store(credential);
        } catch {
          // Ignore password manager errors.
        }
      }
    }

    const next = searchParams.get("next");
    const roleRedirect = data.role ? ROLE_REDIRECTS[data.role] : "/admin";
    router.push(next || roleRedirect);
    router.refresh();
  };

  const legalLinks = [
    { href: "/legal/terms-of-service", en: "Terms of Service", es: "Terminos de Servicio" },
    { href: "/legal/privacy-policy", en: "Privacy Policy", es: "Politica de Privacidad" },
    {
      href: "/legal/payment-cancellation-policy",
      en: "Payment & Cancellation",
      es: "Pago y Cancelacion",
    },
    {
      href: "/legal/disclaimer-limitation-of-liability",
      en: "Disclaimer & Liability",
      es: "Descargo y Responsabilidad",
    },
    { href: "/legal/cookie-notice", en: "Cookie Notice", es: "Aviso de Cookies" },
  ] as const;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#d9f2ff,_#f6f7fb_48%,_#ecf2f8)] text-slate-900">
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(2,132,199,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(2,132,199,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-12">
        <div className="mb-5 flex items-center justify-between gap-3 overflow-hidden sm:mb-6">
          <div className="app-chip inline-flex min-w-0 flex-1 items-center truncate whitespace-nowrap px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
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
            {t("auth.login.headline")} <span className="text-sky-600">{t("auth.login.headlineAccent")}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            {t("auth.login.lede")}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="app-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("auth.login.metrics.quality.kicker")}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{t("auth.login.metrics.quality.title")}</p>
              <p className="mt-1 text-xs text-slate-600">{t("auth.login.metrics.quality.desc")}</p>
            </article>
            <article className="app-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("auth.login.metrics.routes.kicker")}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{t("auth.login.metrics.routes.title")}</p>
              <p className="mt-1 text-xs text-slate-600">{t("auth.login.metrics.routes.desc")}</p>
            </article>
            <article className="app-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("auth.login.metrics.security.kicker")}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{t("auth.login.metrics.security.title")}</p>
              <p className="mt-1 text-xs text-slate-600">{t("auth.login.metrics.security.desc")}</p>
            </article>
          </div>

          <a href="/" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 hover:text-sky-800">
            {t("auth.login.publicLink")}
            <span aria-hidden="true">&rarr;</span>
          </a>
          </section>

          <section className="order-1 app-card w-full max-w-md p-6 sm:p-8 lg:order-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t("app.name")}</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{t("auth.login.title")}</h2>
                <p className="mt-1 text-sm text-slate-600">{t("auth.login.cardSubtitle")}</p>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-sky-100 bg-white">
                <img
                  src="/pwa/app-logo-source.png"
                  alt={`${t("app.name")} logo`}
                  className="h-full w-full object-cover"
                />
              </span>
            </div>

            <form
              ref={formRef}
              className="mt-6 space-y-4"
              onSubmit={handleSubmit}
              autoComplete="on"
              method="post"
              action="/api/auth/login"
            >
              <div>
                <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t("common.labels.email")}
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="app-input mt-2 w-full px-4 py-3 text-sm"
                  placeholder={t("auth.login.emailPlaceholder")}
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t("auth.login.password")}
                </label>
                <div className="relative mt-2">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    className="app-input w-full px-4 py-3 pr-16 text-sm"
                    placeholder={t("auth.login.passwordPlaceholder")}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-2 my-2 inline-flex items-center rounded-md px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={
                      showPassword
                        ? locale === "es"
                          ? "Ocultar contrasena"
                          : "Hide password"
                        : locale === "es"
                          ? "Mostrar contrasena"
                          : "Show password"
                    }
                  >
                    {showPassword
                      ? locale === "es"
                        ? "Ocultar"
                        : "Hide"
                      : locale === "es"
                        ? "Mostrar"
                        : "Show"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="remember"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  {t("auth.login.keepSignedIn")}
                </label>
                <a href="/reset" className="font-semibold text-sky-700 hover:text-sky-800">
                  {t("auth.login.forgot")}
                </a>
              </div>

              {error ? (
                <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="app-button-primary w-full px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? t("auth.login.loading") : t("auth.login.submit")}
              </button>
            </form>
          </section>
        </div>

        <div className="mt-8 border-t border-slate-200/80 pt-4">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Legal
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {legalLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
              >
                {locale === "es" ? item.es : item.en}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

