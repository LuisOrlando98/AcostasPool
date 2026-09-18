"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { LANDING_LOCALE_STORAGE_KEY } from "@/components/landing/preferences";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE } from "@/i18n/config";

type ProfileData = {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  telefonoSecundario: string;
  idiomaPreferencia: string;
  direccionLinea1: string;
  direccionLinea2: string;
  ciudad: string;
  estadoProvincia: string;
  codigoPostal: string;
};

type InviteAccountType = "CUSTOMER" | "TECH";

type ApiResponse = {
  accountType?: InviteAccountType;
  customer?: Partial<ProfileData> & { email?: string };
  technician?: Partial<ProfileData> & { email?: string };
  error?: string;
};

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

export default function CompleteProfilePage() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const currentYear = new Date().getFullYear();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [accountType, setAccountType] = useState<InviteAccountType | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(() => Boolean(token));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(() =>
    token ? null : t("auth.complete.errors.token")
  );
  const [submitting, setSubmitting] = useState(false);
  const [switchingLocale, setSwitchingLocale] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const fieldId = useId();
  const fieldIds = {
    nombre: `${fieldId}-nombre`,
    apellidos: `${fieldId}-apellidos`,
    email: `${fieldId}-email`,
    idiomaPreferencia: `${fieldId}-idioma`,
    telefono: `${fieldId}-telefono`,
    telefonoSecundario: `${fieldId}-telefono-secundario`,
    password: `${fieldId}-password`,
    confirm: `${fieldId}-confirm`,
  };

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

  useEffect(() => {
    if (!token) {
      return;
    }
    fetch(`/api/auth/complete-profile?token=${token}`)
      .then((res) => res.json() as Promise<ApiResponse>)
      .then((data) => {
        if (data.error) {
          setMessage(data.error);
          setProfile(null);
          setAccountType(null);
          return;
        }
        const resolvedAccountType =
          data.accountType ??
          (data.technician ? "TECH" : data.customer ? "CUSTOMER" : undefined);
        if (!resolvedAccountType) {
          setMessage(t("auth.complete.notFound"));
          setProfile(null);
          setAccountType(null);
          return;
        }

        const source = resolvedAccountType === "TECH" ? data.technician ?? {} : data.customer ?? {};
        setAccountType(resolvedAccountType);
        setProfile({
          nombre: source.nombre ?? "",
          apellidos: source.apellidos ?? "",
          email: source.email ?? "",
          telefono: source.telefono ?? "",
          telefonoSecundario: source.telefonoSecundario ?? "",
          idiomaPreferencia: source.idiomaPreferencia ?? "EN",
          direccionLinea1: source.direccionLinea1 ?? "",
          direccionLinea2: source.direccionLinea2 ?? "",
          ciudad: source.ciudad ?? "",
          estadoProvincia: source.estadoProvincia ?? "",
          codigoPostal: source.codigoPostal ?? "",
        });
      })
      .catch(() => {
        setMessage(t("auth.complete.errors.load"));
      })
      .finally(() => setLoadingProfile(false));
  }, [token, t]);

  useEffect(() => {
    if (!message) {
      return;
    }
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [message]);

  const handleSubmit = async () => {
    if (!token) {
      setMessage(t("auth.complete.errors.token"));
      return;
    }
    if (password.length < 10) {
      setMessage(t("auth.complete.errors.length"));
      return;
    }
    if (password !== confirm) {
      setMessage(t("auth.complete.errors.mismatch"));
      return;
    }

    const form = formRef.current;
    if (!form) {
      setMessage(t("auth.complete.errors.submit"));
      return;
    }

    const data = new FormData(form);
    const nombre = String(data.get("nombre") ?? "").trim();
    const apellidos = String(data.get("apellidos") ?? "").trim();
    const telefono = String(data.get("telefono") ?? "").trim();

    if (!nombre || !apellidos || !telefono) {
      setMessage(t("auth.complete.errors.required"));
      return;
    }

    const payload = {
      token,
      password,
      nombre,
      apellidos,
      telefono,
      telefonoSecundario: String(data.get("telefonoSecundario") ?? "").trim(),
      idiomaPreferencia: String(data.get("idiomaPreferencia") ?? "EN"),
      direccionLinea1: String(data.get("direccionLinea1") ?? "").trim(),
      direccionLinea2: String(data.get("direccionLinea2") ?? "").trim(),
      ciudad: String(data.get("ciudad") ?? "").trim(),
      estadoProvincia: String(data.get("estadoProvincia") ?? "").trim(),
      codigoPostal: String(data.get("codigoPostal") ?? "").trim(),
    };

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const rawBody = await res.text().catch(() => "");
        let resolvedError = "";
        if (rawBody) {
          try {
            const parsedError = JSON.parse(rawBody) as { error?: string };
            resolvedError = parsedError.error ?? "";
          } catch {
            resolvedError = "";
          }
        }
        setMessage(resolvedError || t("auth.complete.errors.submit"));
        setSubmitting(false);
        return;
      }

      setMessage(t("auth.complete.success"));
      setSubmitting(false);
    } catch {
      setMessage(t("auth.complete.errors.submit"));
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSubmit();
  };

  const isSuccessMessage = message === t("auth.complete.success");

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
              {t("auth.complete.title")} <span className="text-sky-600">{t("app.name")}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {t("auth.complete.subtitle")}
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
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

            <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.14em]">
              <Link href="/login" className="text-sky-700 hover:text-sky-800">
                {t("auth.login.title")}
              </Link>
              <Link href="/" className="text-sky-700 hover:text-sky-800">
                {t("auth.login.publicLink")}
              </Link>
            </div>
          </section>

          <section
            ref={cardRef}
            className="order-1 app-card w-full max-w-3xl p-6 sm:p-8 lg:order-2"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t("app.name")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{t("auth.complete.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("auth.complete.subtitle")}</p>

            {loadingProfile ? (
              <p className="mt-6 text-sm text-slate-600">{t("auth.complete.loading")}</p>
            ) : isSuccessMessage ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center"
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="h-6 w-6"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
                  </svg>
                </span>
                <h3 className="mt-4 text-lg font-semibold text-emerald-800">
                  {t("auth.complete.success")}
                </h3>
                <p className="mt-1 text-sm text-emerald-700">
                  {t("auth.complete.successHint")}
                </p>
                <Link
                  href="/login"
                  className="app-button-primary mt-5 inline-flex w-full items-center justify-center px-4 py-3 text-sm font-semibold"
                >
                  {t("auth.login.title")}
                </Link>
              </div>
            ) : profile ? (
              <form ref={formRef} className="mt-6 space-y-5" onSubmit={handleFormSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={fieldIds.nombre}
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                    >
                      {t("common.labels.firstName")}
                    </label>
                    <input
                      id={fieldIds.nombre}
                      name="nombre"
                      defaultValue={profile.nombre}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                      autoComplete="given-name"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={fieldIds.apellidos}
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                    >
                      {t("common.labels.lastName")}
                    </label>
                    <input
                      id={fieldIds.apellidos}
                      name="apellidos"
                      defaultValue={profile.apellidos}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                      autoComplete="family-name"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={fieldIds.email}
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                    >
                      {t("common.labels.email")}
                    </label>
                    <input
                      id={fieldIds.email}
                      value={profile.email}
                      readOnly
                      autoComplete="off"
                      className="app-input mt-2 w-full bg-slate-100 px-4 py-3 text-sm text-slate-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={fieldIds.idiomaPreferencia}
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                    >
                      {t("common.labels.language")}
                    </label>
                    <select
                      id={fieldIds.idiomaPreferencia}
                      name="idiomaPreferencia"
                      defaultValue={profile.idiomaPreferencia}
                      className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                    >
                      <option value="EN">EN</option>
                      <option value="ES">ES</option>
                    </select>
                  </div>
                </div>

                <div className={`grid gap-3 ${accountType === "CUSTOMER" ? "sm:grid-cols-2" : ""}`}>
                  <div>
                    <label
                      htmlFor={fieldIds.telefono}
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                    >
                      {t("common.labels.phone")}
                    </label>
                    <input
                      id={fieldIds.telefono}
                      name="telefono"
                      defaultValue={profile.telefono}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                      autoComplete="tel"
                      required
                    />
                  </div>
                  {accountType === "CUSTOMER" ? (
                    <div>
                      <label
                        htmlFor={fieldIds.telefonoSecundario}
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                      >
                        {t("common.labels.phoneSecondary")}
                      </label>
                      <input
                        id={fieldIds.telefonoSecundario}
                        name="telefonoSecundario"
                        defaultValue={profile.telefonoSecundario}
                        className="app-input mt-2 w-full px-4 py-3 text-sm"
                        autoComplete="tel"
                      />
                    </div>
                  ) : null}
                </div>

                {accountType === "CUSTOMER" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <h3 className="text-sm font-semibold text-slate-700">{t("address.sectionTitle")}</h3>
                    <div className="mt-4">
                      <AddressAutocomplete
                        defaultValue={{
                          line1: profile.direccionLinea1,
                          line2: profile.direccionLinea2,
                          city: profile.ciudad,
                          state: profile.estadoProvincia,
                          postalCode: profile.codigoPostal,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={fieldIds.password}
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                    >
                      {t("auth.complete.password")}
                    </label>
                    <input
                      id={fieldIds.password}
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={fieldIds.confirm}
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                    >
                      {t("auth.complete.passwordConfirm")}
                    </label>
                    <input
                      id={fieldIds.confirm}
                      type="password"
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {message ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  >
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="app-button-primary w-full px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? t("auth.complete.loadingSubmit") : t("auth.complete.submit")}
                </button>
              </form>
            ) : (
              <p role="alert" className="mt-6 text-sm text-slate-600">
                {message ?? t("auth.complete.notFound")}
              </p>
            )}
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
