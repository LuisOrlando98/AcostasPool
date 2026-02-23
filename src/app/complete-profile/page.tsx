"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { useI18n } from "@/i18n/client";

const emptyProfile = {
  nombre: "",
  apellidos: "",
  email: "",
  telefono: "",
  telefonoSecundario: "",
  idiomaPreferencia: "EN",
  direccionLinea1: "",
  direccionLinea2: "",
  ciudad: "",
  estadoProvincia: "",
  codigoPostal: "",
};

type ProfileData = typeof emptyProfile;

type ApiResponse = {
  customer?: Partial<ProfileData> & { email?: string };
  error?: string;
};

export default function CompleteProfilePage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!token) {
      setMessage(t("auth.complete.errors.token"));
      return;
    }
    setLoadingProfile(true);
    fetch(`/api/auth/complete-profile?token=${token}`)
      .then((res) => res.json() as Promise<ApiResponse>)
      .then((data) => {
        if (data.error) {
          setMessage(data.error);
          setProfile(null);
          return;
        }
        const customer = data.customer ?? {};
        setProfile({
          nombre: customer.nombre ?? "",
          apellidos: customer.apellidos ?? "",
          email: customer.email ?? "",
          telefono: customer.telefono ?? "",
          telefonoSecundario: customer.telefonoSecundario ?? "",
          idiomaPreferencia: customer.idiomaPreferencia ?? "EN",
          direccionLinea1: customer.direccionLinea1 ?? "",
          direccionLinea2: customer.direccionLinea2 ?? "",
          ciudad: customer.ciudad ?? "",
          estadoProvincia: customer.estadoProvincia ?? "",
          codigoPostal: customer.codigoPostal ?? "",
        });
      })
      .catch(() => {
        setMessage(t("auth.complete.errors.load"));
      })
      .finally(() => setLoadingProfile(false));
  }, [token, t]);

  const handleSubmit = async () => {
    if (!token) {
      setMessage(t("auth.complete.errors.token"));
      return;
    }
    if (password.length < 6) {
      setMessage(t("auth.complete.errors.length"));
      return;
    }
    if (password !== confirm) {
      setMessage(t("auth.complete.errors.mismatch"));
      return;
    }

    const form = formRef.current;
    if (!form) {
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

    const res = await fetch("/api/auth/complete-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      setMessage(errorData.error ?? t("auth.complete.errors.submit"));
      setSubmitting(false);
      return;
    }

    setMessage(t("auth.complete.success"));
    setSubmitting(false);
  };

  const isSuccessMessage = message === t("auth.complete.success");

  return (
    <div className="pool-login-shell min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-center lg:justify-between">
        <section className="w-full max-w-xl space-y-6">
          <div className="pool-login-badge inline-flex items-center gap-2">
            {t("auth.login.kicker")}
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {t("auth.complete.title")} <span className="text-[#30bced]">{t("app.name")}</span>.
          </h1>
          <p className="text-sm text-white/70 sm:text-base">{t("auth.complete.subtitle")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="pool-login-metric">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                {t("auth.login.metrics.quality.kicker")}
              </p>
              <p className="mt-2 text-sm font-semibold">{t("auth.login.metrics.quality.title")}</p>
              <p className="mt-1 text-xs text-white/60">{t("auth.login.metrics.quality.desc")}</p>
            </div>
            <div className="pool-login-metric">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                {t("auth.login.metrics.routes.kicker")}
              </p>
              <p className="mt-2 text-sm font-semibold">{t("auth.login.metrics.routes.title")}</p>
              <p className="mt-1 text-xs text-white/60">{t("auth.login.metrics.routes.desc")}</p>
            </div>
            <div className="pool-login-metric">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                {t("auth.login.metrics.security.kicker")}
              </p>
              <p className="mt-2 text-sm font-semibold">{t("auth.login.metrics.security.title")}</p>
              <p className="mt-1 text-xs text-white/60">{t("auth.login.metrics.security.desc")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            <Link href="/login" className="pool-login-link">
              {t("auth.login.title")}
            </Link>
            <Link href="/" className="pool-login-link">
              {t("auth.login.publicLink")}
            </Link>
          </div>
        </section>

        <section className="pool-login-card w-full max-w-3xl p-8">
          <h2 className="text-xl font-semibold text-[#30bced]">{t("auth.complete.title")}</h2>

          {loadingProfile ? (
            <p className="mt-6 text-sm text-white/70">{t("auth.complete.loading")}</p>
          ) : profile ? (
            <form ref={formRef} className="mt-6 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    {t("common.labels.firstName")}
                  </label>
                  <input
                    name="nombre"
                    defaultValue={profile.nombre}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    {t("common.labels.lastName")}
                  </label>
                  <input
                    name="apellidos"
                    defaultValue={profile.apellidos}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    {t("common.labels.email")}
                  </label>
                  <input
                    value={profile.email}
                    readOnly
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    {t("common.labels.language")}
                  </label>
                  <select
                    name="idiomaPreferencia"
                    defaultValue={profile.idiomaPreferencia}
                    className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                  >
                    <option value="EN">EN</option>
                    <option value="ES">ES</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    {t("common.labels.phone")}
                  </label>
                  <input
                    name="telefono"
                    defaultValue={profile.telefono}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    {t("common.labels.phoneSecondary")}
                  </label>
                  <input
                    name="telefonoSecundario"
                    defaultValue={profile.telefonoSecundario}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-white/80">{t("address.sectionTitle")}</h3>
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    {t("auth.complete.password")}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    {t("auth.complete.passwordConfirm")}
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    required
                  />
                </div>
              </div>

              {message ? (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    isSuccessMessage
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                      : "border-rose-400/40 bg-rose-500/15 text-rose-100"
                  }`}
                >
                  {message}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full rounded-full bg-[#30bced] px-4 py-3 text-sm font-semibold text-[#07182b] transition hover:bg-[#52d6ff] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? t("auth.complete.loadingSubmit") : t("auth.complete.submit")}
              </button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-white/70">{message ?? t("auth.complete.notFound")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
