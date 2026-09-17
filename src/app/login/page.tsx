"use client";

import Link from "next/link";
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

const storePasswordCredential = async (form: HTMLFormElement) => {
  const PasswordCredentialCtor = (
    window as Window & { PasswordCredential?: PasswordCredentialCtor }
  ).PasswordCredential;
  if (!PasswordCredentialCtor || !navigator.credentials?.store) {
    return;
  }
  try {
    const credential = new PasswordCredentialCtor(form);
    await navigator.credentials.store(credential);
  } catch {
    // Ignore password manager errors.
  }
};

/**
 * Accepts `?next=` only when it is a same-origin path inside the area the
 * role can actually open; anything else falls back to the role home. This
 * avoids open redirects and the /unauthorized bounce a CUSTOMER would get
 * after logging in from /login?next=/admin.
 */
function resolvePostLoginPath(next: string | null, roleRedirect: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return roleRedirect;
  }
  const insideRoleArea =
    next === roleRedirect ||
    next.startsWith(`${roleRedirect}/`) ||
    next.startsWith(`${roleRedirect}?`);
  return insideRoleArea ? next : roleRedirect;
}

const LEGAL_LINKS = [
  {
    href: "/legal/terms-of-service",
    labelKey: "auth.legal.links.terms",
    shortLabelKey: "auth.legal.links.termsShort",
  },
  {
    href: "/legal/privacy-policy",
    labelKey: "auth.legal.links.privacy",
    shortLabelKey: "auth.legal.links.privacyShort",
  },
  {
    href: "/legal/payment-cancellation-policy",
    labelKey: "auth.legal.links.payments",
    shortLabelKey: "auth.legal.links.paymentsShort",
  },
  {
    href: "/legal/disclaimer-limitation-of-liability",
    labelKey: "auth.legal.links.liability",
    shortLabelKey: "auth.legal.links.liabilityShort",
  },
  {
    href: "/legal/cookie-notice",
    labelKey: "auth.legal.links.cookies",
    shortLabelKey: "auth.legal.links.cookiesShort",
  },
] as const;

export default function LoginPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchingLocale, setSwitchingLocale] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const resetSuccess = searchParams.get("reset") === "success";

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    let redirecting = false;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });

      const data = (await res.json().catch(() => ({}))) as LoginResponse;

      if (!res.ok) {
        setError(data.error ?? t("auth.login.error"));
        return;
      }

      if (formRef.current && typeof window !== "undefined") {
        await storePasswordCredential(formRef.current);
      }

      const roleRedirect = data.role ? ROLE_REDIRECTS[data.role] : "/admin";
      redirecting = true;
      router.push(resolvePostLoginPath(searchParams.get("next"), roleRedirect));
      router.refresh();
    } catch {
      setError(t("auth.login.error"));
    } finally {
      // Keep the submit button in its loading state while the redirect is in flight.
      if (!redirecting) {
        setLoading(false);
      }
    }
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
            {t("auth.login.headline")} <span className="text-sky-600">{t("auth.login.headlineAccent")}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            {t("auth.login.lede")}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            <article className="app-card p-3 sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">
                {t("auth.login.metrics.quality.kicker")}
              </p>
              <p className="mt-2 text-xs font-semibold leading-4 text-slate-900 sm:text-sm">
                {t("auth.login.metrics.quality.title")}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-600 sm:text-xs">{t("auth.login.metrics.quality.desc")}</p>
            </article>
            <article className="app-card p-3 sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">
                {t("auth.login.metrics.routes.kicker")}
              </p>
              <p className="mt-2 text-xs font-semibold leading-4 text-slate-900 sm:text-sm">
                {t("auth.login.metrics.routes.title")}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-600 sm:text-xs">{t("auth.login.metrics.routes.desc")}</p>
            </article>
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
          </div>

          <Link href="/" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 hover:text-sky-800">
            {t("auth.login.publicLink")}
            <span aria-hidden="true">&rarr;</span>
          </Link>
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
                        ? t("auth.login.hidePassword")
                        : t("auth.login.showPassword")
                    }
                  >
                    {showPassword ? t("auth.login.hide") : t("auth.login.show")}
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
                <div
                  role="alert"
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                  {error}
                </div>
              ) : null}
              {!error && resetSuccess ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  {t("auth.reset.success")}
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

        <div className="mt-8 border-t border-slate-200/80 pt-3">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t("auth.legal.title")}
          </p>
          <nav
            aria-label={t("auth.legal.navLabel")}
            className="mx-auto mt-2 max-w-3xl rounded-2xl border border-sky-200/70 bg-[linear-gradient(135deg,rgba(4,36,58,0.95),rgba(5,68,96,0.88))] px-3 py-2"
          >
            <ul className="flex flex-wrap items-center justify-center gap-y-1 text-center">
              {LEGAL_LINKS.map((item, index) => (
                <li key={item.href} className="inline-flex items-center">
                  <a
                    href={item.href}
                    className="px-2 text-[10px] font-medium text-sky-50/92 transition hover:text-white sm:text-[11px]"
                  >
                    <span className="sm:hidden">{t(item.shortLabelKey)}</span>
                    <span className="hidden sm:inline">{t(item.labelKey)}</span>
                  </a>
                  {index < LEGAL_LINKS.length - 1 ? (
                    <span aria-hidden="true" className="px-1 text-[10px] text-sky-100/55">
                      |
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
          <p className="mt-4 text-center text-[11px] text-slate-500">
            {t("auth.legal.copyright", { year: currentYear })}
          </p>
        </div>
      </div>
    </div>
  );
}

