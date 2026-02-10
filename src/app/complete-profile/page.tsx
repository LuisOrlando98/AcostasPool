"use client";

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

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12">
        <div className="app-card w-full p-8 shadow-contrast">
          <h1 className="text-2xl font-semibold">{t("auth.complete.title")}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("auth.complete.subtitle")}
          </p>

          {loadingProfile ? (
            <p className="mt-6 text-sm text-slate-500">
              {t("auth.complete.loading")}
            </p>
          ) : profile ? (
            <form ref={formRef} className="mt-6 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.email")}
                  </label>
                  <input
                    value={profile.email}
                    readOnly
                    className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.phoneSecondary")}
                  </label>
                  <input
                    name="telefonoSecundario"
                    defaultValue={profile.telefonoSecundario}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="app-card border border-[var(--border)] bg-[var(--surface-2)] p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700">
                  {t("address.sectionTitle")}
                </h2>
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {message}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="app-button-primary w-full px-4 py-3 text-sm font-semibold disabled:opacity-70"
              >
                {submitting
                  ? t("auth.complete.loadingSubmit")
                  : t("auth.complete.submit")}
              </button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-slate-500">
              {message ?? t("auth.complete.notFound")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
