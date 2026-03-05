"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AvatarUpload from "@/components/account/AvatarUpload";
import ResetLinkButton from "@/components/account/ResetLinkButton";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import { useI18n } from "@/i18n/client";

type ProfileData = {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  telefonoSecundario: string;
  idiomaPreferencia: "EN" | "ES";
  direccionLinea1: string;
  direccionLinea2: string;
  ciudad: string;
  estadoProvincia: string;
  codigoPostal: string;
  avatarUrl: string | null;
  statusLabel: string;
  displayName: string;
  email2faEnabled: boolean;
};

type Props = {
  initialData: ProfileData;
};

type PersonalDraft = {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  telefonoSecundario: string;
  idiomaPreferencia: "EN" | "ES";
};

type AddressDraft = {
  direccionLinea1: string;
  direccionLinea2: string;
  ciudad: string;
  estadoProvincia: string;
  codigoPostal: string;
};

export default function ClientProfilePanel({ initialData }: Props) {
  const { t } = useI18n();
  const [data, setData] = useState(initialData);
  const [personalDraft, setPersonalDraft] = useState<PersonalDraft>({
    nombre: initialData.nombre,
    apellidos: initialData.apellidos,
    email: initialData.email,
    telefono: initialData.telefono,
    telefonoSecundario: initialData.telefonoSecundario,
    idiomaPreferencia: initialData.idiomaPreferencia,
  });
  const [addressDraft, setAddressDraft] = useState<AddressDraft>({
    direccionLinea1: initialData.direccionLinea1,
    direccionLinea2: initialData.direccionLinea2,
    ciudad: initialData.ciudad,
    estadoProvincia: initialData.estadoProvincia,
    codigoPostal: initialData.codigoPostal,
  });
  const [editor, setEditor] = useState<"personal" | "address" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveSuccessTimerRef.current) {
        clearTimeout(saveSuccessTimerRef.current);
      }
    },
    []
  );

  const hasAddress = useMemo(
    () =>
      Boolean(
        data.direccionLinea1 ||
          data.direccionLinea2 ||
          data.ciudad ||
          data.estadoProvincia ||
          data.codigoPostal
      ),
    [
      data.ciudad,
      data.codigoPostal,
      data.direccionLinea1,
      data.direccionLinea2,
      data.estadoProvincia,
    ]
  );

  const openPersonalEditor = () => {
    setPersonalDraft({
      nombre: data.nombre,
      apellidos: data.apellidos,
      email: data.email,
      telefono: data.telefono,
      telefonoSecundario: data.telefonoSecundario,
      idiomaPreferencia: data.idiomaPreferencia,
    });
    setError(null);
    setEditor("personal");
    setConfirmOpen(false);
    setSaveSuccess(false);
  };

  const openAddressEditor = () => {
    setAddressDraft({
      direccionLinea1: data.direccionLinea1,
      direccionLinea2: data.direccionLinea2,
      ciudad: data.ciudad,
      estadoProvincia: data.estadoProvincia,
      codigoPostal: data.codigoPostal,
    });
    setError(null);
    setEditor("address");
    setConfirmOpen(false);
    setSaveSuccess(false);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }
    setEditor(null);
    setConfirmOpen(false);
    setSaveSuccess(false);
    setError(null);
  };

  const reviewChanges = () => {
    if (editor === "personal") {
      if (
        !personalDraft.nombre.trim() ||
        !personalDraft.apellidos.trim() ||
        !personalDraft.email.trim() ||
        !personalDraft.telefono.trim()
      ) {
        setError(t("client.profile.editor.personalRequired"));
        return;
      }
    }
    if (editor === "address") {
      const hasAny =
        addressDraft.direccionLinea1.trim() ||
        addressDraft.ciudad.trim() ||
        addressDraft.estadoProvincia.trim() ||
        addressDraft.codigoPostal.trim();
      if (
        hasAny &&
        (!addressDraft.direccionLinea1.trim() ||
          !addressDraft.ciudad.trim() ||
          !addressDraft.estadoProvincia.trim() ||
          !addressDraft.codigoPostal.trim())
      ) {
        setError(t("client.profile.editor.addressRequired"));
        return;
      }
    }
    setError(null);
    setConfirmOpen(true);
  };

  const saveChanges = async () => {
    if (!editor || saving) {
      return;
    }
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    const payload =
      editor === "personal"
        ? { kind: "personal", ...personalDraft }
        : { kind: "address", ...addressDraft };

    const response = await fetch("/api/client/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setSaving(false);
      setError(
        typeof body?.error === "string"
          ? body.error
          : t("client.profile.editor.saveFailed")
      );
      setSaveSuccess(false);
      return;
    }

    if (editor === "personal") {
      setData((current) => ({
        ...current,
        ...personalDraft,
        displayName: `${personalDraft.nombre} ${personalDraft.apellidos}`.trim(),
      }));
      setNotice(t("client.profile.editor.personalSaved"));
    } else {
      setData((current) => ({
        ...current,
        ...addressDraft,
      }));
      setNotice(t("client.profile.editor.addressSaved"));
    }

    setSaveSuccess(true);
    setSaving(false);
    if (saveSuccessTimerRef.current) {
      clearTimeout(saveSuccessTimerRef.current);
    }
    saveSuccessTimerRef.current = setTimeout(() => {
      setSaveSuccess(false);
      setEditor(null);
      setConfirmOpen(false);
    }, 850);
  };

  const toggle2fa = async () => {
    if (securitySaving) {
      return;
    }
    const nextValue = !data.email2faEnabled;
    setSecuritySaving(true);
    const response = await fetch("/api/client/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "security", email2faEnabled: nextValue }),
    });

    if (!response.ok) {
      setSecuritySaving(false);
      setError(t("client.profile.security.twoFaError"));
      return;
    }

    setData((current) => ({ ...current, email2faEnabled: nextValue }));
    setSecuritySaving(false);
    setNotice(
      nextValue
        ? t("client.profile.security.twoFaEnabled")
        : t("client.profile.security.twoFaDisabled")
    );
  };

  return (
    <div className="space-y-6">
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {t("roles.client")}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {data.displayName}
                </h2>
                <p className="text-sm text-slate-500">{data.email}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {data.statusLabel}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">
                {t("client.profile.sections.personalTitle")}
              </h3>
              <button
                type="button"
                onClick={openPersonalEditor}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
              >
                {t("common.actions.edit")}
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p>
                <span className="font-semibold text-slate-800">
                  {t("common.labels.firstName")}:
                </span>{" "}
                {data.nombre}
              </p>
              <p>
                <span className="font-semibold text-slate-800">
                  {t("common.labels.lastName")}:
                </span>{" "}
                {data.apellidos}
              </p>
              <p>
                <span className="font-semibold text-slate-800">
                  {t("common.labels.email")}:
                </span>{" "}
                {data.email}
              </p>
              <p>
                <span className="font-semibold text-slate-800">
                  {t("common.labels.language")}:
                </span>{" "}
                {data.idiomaPreferencia}
              </p>
              <p>
                <span className="font-semibold text-slate-800">
                  {t("common.labels.phone")}:
                </span>{" "}
                {data.telefono}
              </p>
              <p>
                <span className="font-semibold text-slate-800">
                  {t("common.labels.phoneSecondary")}:
                </span>{" "}
                {data.telefonoSecundario || t("common.labels.notAvailable")}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">
                {t("client.profile.sections.addressTitle")}
              </h3>
              <button
                type="button"
                onClick={openAddressEditor}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
              >
                {t("common.actions.edit")}
              </button>
            </div>
            {hasAddress ? (
              <div className="mt-4 space-y-1 text-sm text-slate-600">
                <p>{data.direccionLinea1}</p>
                {data.direccionLinea2 ? <p>{data.direccionLinea2}</p> : null}
                <p>
                  {[data.ciudad, data.estadoProvincia, data.codigoPostal]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                {t("client.profile.sections.addressEmpty")}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {t("client.profile.sections.photoTitle")}
            </h3>
            <div className="mt-4">
              <AvatarUpload avatarUrl={data.avatarUrl} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {t("client.profile.security.title")}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {t("client.profile.security.subtitle")}
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                  disabled={securitySaving}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                    data.email2faEnabled ? "bg-emerald-500" : "bg-slate-300"
                  } ${securitySaving ? "opacity-70" : ""}`}
                  aria-label={t("client.profile.security.twoFaTitle")}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      data.email2faEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="mt-4">
              <ResetLinkButton
                submitLabel={t("client.profile.security.reset.submit")}
                loadingLabel={t("client.profile.security.reset.loading")}
                sentLabel={t("client.profile.security.reset.sent")}
                errorLabel={t("client.profile.security.reset.error")}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {t("client.profile.sections.notificationsTitle")}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {t("client.profile.sections.notificationsSubtitle")}
            </p>
            <NotificationPreferences />
          </div>
        </div>
      </section>

      {editor ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            aria-label={t("common.actions.close")}
            onClick={closeModal}
          />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="modal-scroll max-h-[88vh] overflow-y-auto p-5 sm:p-6">
              <h3 className="text-xl font-semibold text-slate-900">
                {editor === "personal"
                  ? t("client.profile.editor.personalTitle")
                  : t("client.profile.editor.addressTitle")}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {editor === "personal"
                  ? t("client.profile.editor.personalSubtitle")
                  : t("client.profile.editor.addressSubtitle")}
              </p>

              {editor === "personal" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input
                    value={personalDraft.nombre}
                    onChange={(event) =>
                      setPersonalDraft((current) => ({
                        ...current,
                        nombre: event.target.value,
                      }))
                    }
                    className="app-input w-full px-4 py-3 text-sm"
                    placeholder={t("common.labels.firstName")}
                  />
                  <input
                    value={personalDraft.apellidos}
                    onChange={(event) =>
                      setPersonalDraft((current) => ({
                        ...current,
                        apellidos: event.target.value,
                      }))
                    }
                    className="app-input w-full px-4 py-3 text-sm"
                    placeholder={t("common.labels.lastName")}
                  />
                  <input
                    value={personalDraft.email}
                    onChange={(event) =>
                      setPersonalDraft((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="app-input w-full px-4 py-3 text-sm"
                    placeholder={t("common.labels.email")}
                  />
                  <select
                    value={personalDraft.idiomaPreferencia}
                    onChange={(event) =>
                      setPersonalDraft((current) => ({
                        ...current,
                        idiomaPreferencia: event.target.value === "ES" ? "ES" : "EN",
                      }))
                    }
                    className="app-input w-full bg-white px-4 py-3 text-sm"
                  >
                    <option value="EN">EN</option>
                    <option value="ES">ES</option>
                  </select>
                  <input
                    value={personalDraft.telefono}
                    onChange={(event) =>
                      setPersonalDraft((current) => ({
                        ...current,
                        telefono: event.target.value,
                      }))
                    }
                    className="app-input w-full px-4 py-3 text-sm"
                    placeholder={t("common.labels.phone")}
                  />
                  <input
                    value={personalDraft.telefonoSecundario}
                    onChange={(event) =>
                      setPersonalDraft((current) => ({
                        ...current,
                        telefonoSecundario: event.target.value,
                      }))
                    }
                    className="app-input w-full px-4 py-3 text-sm"
                    placeholder={t("common.labels.phoneSecondary")}
                  />
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input
                    value={addressDraft.direccionLinea1}
                    onChange={(event) =>
                      setAddressDraft((current) => ({
                        ...current,
                        direccionLinea1: event.target.value,
                      }))
                    }
                    className="app-input w-full px-4 py-3 text-sm sm:col-span-2"
                    placeholder={t("address.line1")}
                  />
                  <input
                    value={addressDraft.direccionLinea2}
                    onChange={(event) =>
                      setAddressDraft((current) => ({
                        ...current,
                        direccionLinea2: event.target.value,
                      }))
                    }
                    className="app-input w-full px-4 py-3 text-sm sm:col-span-2"
                    placeholder={t("address.line2")}
                  />
                  <input
                    value={addressDraft.ciudad}
                    onChange={(event) =>
                      setAddressDraft((current) => ({
                        ...current,
                        ciudad: event.target.value,
                      }))
                    }
                    className="app-input w-full px-4 py-3 text-sm"
                    placeholder={t("address.city")}
                  />
                  <input
                    value={addressDraft.estadoProvincia}
                    onChange={(event) =>
                      setAddressDraft((current) => ({
                        ...current,
                        estadoProvincia: event.target.value,
                      }))
                    }
                    className="app-input w-full px-4 py-3 text-sm"
                    placeholder={t("address.state")}
                  />
                  <input
                    value={addressDraft.codigoPostal}
                    onChange={(event) =>
                      setAddressDraft((current) => ({
                        ...current,
                        codigoPostal: event.target.value,
                      }))
                    }
                    className="app-input w-full px-4 py-3 text-sm sm:col-span-2"
                    placeholder={t("address.postal")}
                  />
                </div>
              )}

              {error ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  {t("common.actions.cancel")}
                </button>
                <button
                  type="button"
                  onClick={reviewChanges}
                  className="app-button-primary px-5 py-2 text-sm font-semibold"
                >
                  {t("client.profile.editor.review")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmOpen && editor ? (
        <div className="fixed inset-0 z-[1310] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px]"
            aria-label={t("common.actions.close")}
            onClick={() => !saving && setConfirmOpen(false)}
          />
          <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="p-5 sm:p-6">
              <h3 className="text-xl font-semibold text-slate-900">
                {t("client.profile.confirm.title")}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {t("client.profile.confirm.subtitle")}
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                {editor === "personal" ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p>{personalDraft.nombre}</p>
                    <p>{personalDraft.apellidos}</p>
                    <p>{personalDraft.email}</p>
                    <p>{personalDraft.idiomaPreferencia}</p>
                    <p>{personalDraft.telefono}</p>
                    <p>{personalDraft.telefonoSecundario || "-"}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p>{addressDraft.direccionLinea1 || "-"}</p>
                    <p>{addressDraft.direccionLinea2 || "-"}</p>
                    <p>
                      {[addressDraft.ciudad, addressDraft.estadoProvincia, addressDraft.codigoPostal]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </p>
                  </div>
                )}
              </div>

              {error ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={saving || saveSuccess}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                >
                  {t("client.profile.confirm.back")}
                </button>
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={saving || saveSuccess}
                  className="app-button-primary px-5 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {saving
                    ? t("common.feedback.saving")
                    : saveSuccess
                      ? t("common.feedback.saved")
                      : t("client.profile.confirm.confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
