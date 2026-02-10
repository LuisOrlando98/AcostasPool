"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { ROLE_REDIRECTS } from "@/lib/auth/config";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE } from "@/i18n/config";

type LoginResponse = {
  ok?: boolean;
  role?: keyof typeof ROLE_REDIRECTS;
  error?: string;
};

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
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleLocaleChange = (nextLocale: "en" | "es") => {
    if (nextLocale === locale) {
      return;
    }
    setSwitchingLocale(true);
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
        window as typeof window & { PasswordCredential?: typeof PasswordCredential }
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

  return (
    <div className="pool-login-shell relative min-h-screen">
      <div className="absolute right-6 top-6">
        <div className="flex items-center rounded-full border border-white/12 bg-white/5 p-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          <button
            type="button"
            onClick={() => handleLocaleChange("en")}
            className={`rounded-full px-3 py-1 transition ${
              locale === "en" ? "bg-[#30bced] text-[#07182b]" : "hover:text-white"
            }`}
            disabled={switchingLocale}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => handleLocaleChange("es")}
            className={`rounded-full px-3 py-1 transition ${
              locale === "es" ? "bg-[#30bced] text-[#07182b]" : "hover:text-white"
            }`}
            disabled={switchingLocale}
          >
            ES
          </button>
        </div>
      </div>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-center lg:justify-between">
        <section className="w-full max-w-xl space-y-6">
          <div className="pool-login-badge inline-flex items-center gap-2">
            {t("auth.login.kicker")}
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {t("auth.login.headline")}{" "}
            <span className="text-[#30bced]">
              {t("auth.login.headlineAccent")}
            </span>
            .
          </h1>
          <p className="text-sm text-white/70 sm:text-base">
            {t("auth.login.lede")}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="pool-login-metric">
              <div className="flex items-center gap-2 text-white/80">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#30bced]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3s6 6.5 6 11a6 6 0 11-12 0c0-4.5 6-11 6-11z"
                    />
                  </svg>
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  {t("auth.login.metrics.quality.kicker")}
                </p>
              </div>
              <p className="mt-3 text-sm font-semibold">
                {t("auth.login.metrics.quality.title")}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {t("auth.login.metrics.quality.desc")}
              </p>
            </div>
            <div className="pool-login-metric">
              <div className="flex items-center gap-2 text-white/80">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#30bced]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.5 6.5l5-2 7 2 5-2v12l-5 2-7-2-5 2v-12z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.5 4.5v12M15.5 6.5v12"
                    />
                  </svg>
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  {t("auth.login.metrics.routes.kicker")}
                </p>
              </div>
              <p className="mt-3 text-sm font-semibold">
                {t("auth.login.metrics.routes.title")}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {t("auth.login.metrics.routes.desc")}
              </p>
            </div>
            <div className="pool-login-metric">
              <div className="flex items-center gap-2 text-white/80">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#30bced]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3l7 3v6c0 4.5-3.1 7.6-7 9-3.9-1.4-7-4.5-7-9V6l7-3z"
                    />
                  </svg>
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  {t("auth.login.metrics.security.kicker")}
                </p>
              </div>
              <p className="mt-3 text-sm font-semibold">
                {t("auth.login.metrics.security.title")}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {t("auth.login.metrics.security.desc")}
              </p>
            </div>
          </div>
          <a
            href="/"
            className="pool-login-link inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]"
          >
            {t("auth.login.publicLink")}
            <span className="text-base leading-none">→</span>
          </a>
        </section>

        <section className="pool-login-card w-full max-w-md p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                {t("app.name")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#30bced]">
                {t("auth.login.title")}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                {t("auth.login.cardSubtitle")}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#30bced] text-[#07182b]">
              <span className="text-sm font-semibold">AP</span>
            </div>
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
              <label
                htmlFor="login-email"
                className="text-xs font-semibold uppercase tracking-wider text-white/60"
              >
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
              <label
                htmlFor="login-password"
                className="text-xs font-semibold uppercase tracking-wider text-white/60"
              >
                {t("auth.login.password")}
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="app-input mt-2 w-full px-4 py-3 text-sm"
                placeholder={t("auth.login.passwordPlaceholder")}
                required
              />
            </div>
            <div className="flex items-center justify-between text-xs text-white/60">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-4 w-4 rounded border-white/20 bg-white/10"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                {t("auth.login.keepSignedIn")}
              </label>
              <a
                href="/reset"
                className="font-semibold text-white/80 hover:text-white"
              >
                {t("auth.login.forgot")}
              </a>
            </div>
            {error ? (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#30bced] px-4 py-3 text-sm font-semibold text-[#07182b] transition hover:bg-[#52d6ff] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? t("auth.login.loading") : t("auth.login.submit")}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
