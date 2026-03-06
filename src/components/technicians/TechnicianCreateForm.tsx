"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/client";

type FieldName = "firstName" | "lastName" | "email" | "phone" | "colorHex" | "notes";

type CreateTechnicianResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<FieldName, string>>;
};

type Props = {
  createTechnicianAction: (formData: FormData) => Promise<CreateTechnicianResult>;
};

function closeNewTechModal() {
  const modalToggle = document.getElementById("new-tech");
  if (modalToggle instanceof HTMLInputElement) {
    modalToggle.checked = false;
  }
}

export default function TechnicianCreateForm({ createTechnicianAction }: Props) {
  const { t, locale } = useI18n();
  const formRef = useRef<HTMLFormElement | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  const requiredMessage =
    locale === "es" ? "Este campo es obligatorio." : "This field is required.";
  const invalidEmailMessage =
    locale === "es" ? "Ingresa un email valido." : "Enter a valid email.";
  const invalidPhoneMessage =
    locale === "es"
      ? "Ingresa un telefono valido de EE. UU."
      : "Enter a valid U.S. phone number.";
  const inviteSuccessMessage =
    locale === "es"
      ? "Tecnico creado e invitacion enviada."
      : "Technician created and invitation sent.";
  const closingMessage = locale === "es" ? "Cerrando formulario..." : "Closing form...";

  useEffect(
    () => () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    },
    []
  );

  const resolveServerFieldError = (value: string) => {
    if (value === "Required") {
      return requiredMessage;
    }
    if (value === "Invalid phone format") {
      return invalidPhoneMessage;
    }
    if (value === "Email already in use") {
      return locale === "es" ? "Este email ya esta en uso." : "This email is already in use.";
    }
    return value;
  };

  const validateClient = (formData: FormData) => {
    const nextErrors: Partial<Record<FieldName, string>> = {};

    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();

    if (!firstName) {
      nextErrors.firstName = requiredMessage;
    }
    if (!lastName) {
      nextErrors.lastName = requiredMessage;
    }
    if (!email) {
      nextErrors.email = requiredMessage;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = invalidEmailMessage;
    }
    if (!phone) {
      nextErrors.phone = requiredMessage;
    }

    return nextErrors;
  };

  const handleFieldChange = (field: FieldName) => {
    if (!fieldErrors[field]) {
      return;
    }
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const inputClass = (field: FieldName) =>
    `app-input mt-2 w-full px-4 py-3 text-sm ${
      fieldErrors[field]
        ? "border-rose-400 focus:border-rose-500 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.16)]"
        : ""
    }`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const clientErrors = validateClient(formData);

    if (Object.values(clientErrors).some(Boolean)) {
      setFieldErrors(clientErrors);
      setFormError(
        locale === "es"
          ? "Completa los campos requeridos para continuar."
          : "Complete the required fields to continue."
      );
      return;
    }

    setFormError(null);
    setFieldErrors({});
    setPending(true);

    try {
      const result = await createTechnicianAction(formData);
      if (!result.ok) {
        if (result.fieldErrors) {
          const normalizedErrors = Object.fromEntries(
            Object.entries(result.fieldErrors).map(([key, value]) => [
              key,
              value ? resolveServerFieldError(value) : undefined,
            ])
          ) as Partial<Record<FieldName, string>>;
          setFieldErrors(normalizedErrors);
        }
        setFormError(
          result.error ??
            (locale === "es"
              ? "No se pudo crear el tecnico. Revisa los datos."
              : "Could not create technician. Check the data.")
        );
        setPending(false);
        return;
      }

      setShowSuccess(true);
      setFormError(null);
      setPending(false);

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => {
        formRef.current?.reset();
        setFieldErrors({});
        setShowSuccess(false);
        closeNewTechModal();
      }, 2200);
    } catch {
      setFormError(
        locale === "es"
          ? "Error inesperado al crear el tecnico."
          : "Unexpected error while creating technician."
      );
      setPending(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("common.labels.firstName")}
          </label>
          <input
            name="firstName"
            onChange={() => handleFieldChange("firstName")}
            aria-invalid={fieldErrors.firstName ? "true" : "false"}
            className={inputClass("firstName")}
          />
          {fieldErrors.firstName ? (
            <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.firstName}</p>
          ) : null}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("common.labels.lastName")}
          </label>
          <input
            name="lastName"
            onChange={() => handleFieldChange("lastName")}
            aria-invalid={fieldErrors.lastName ? "true" : "false"}
            className={inputClass("lastName")}
          />
          {fieldErrors.lastName ? (
            <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.lastName}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("common.labels.email")}
          </label>
          <input
            name="email"
            type="email"
            onChange={() => handleFieldChange("email")}
            aria-invalid={fieldErrors.email ? "true" : "false"}
            className={inputClass("email")}
          />
          {fieldErrors.email ? (
            <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.email}</p>
          ) : null}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("common.labels.phone")}
          </label>
          <input
            name="phone"
            onChange={() => handleFieldChange("phone")}
            aria-invalid={fieldErrors.phone ? "true" : "false"}
            className={inputClass("phone")}
          />
          {fieldErrors.phone ? (
            <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.phone}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t("admin.technicians.newTech.fields.calendarColor")}
        </label>
        <input
          name="colorHex"
          type="color"
          defaultValue="#38bdf8"
          className="mt-2 h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t("admin.technicians.newTech.fields.notes")}
        </label>
        <textarea
          name="notes"
          className="app-input mt-2 min-h-[90px] w-full px-4 py-3 text-sm"
          onChange={() => handleFieldChange("notes")}
        />
      </div>

      {formError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {formError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="app-button-primary inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {t("common.feedback.creating")}
          </>
        ) : (
          t("admin.technicians.newTech.actions.create")
        )}
      </button>

      <p className="text-[11px] text-slate-500">
        {t("admin.technicians.newTech.inviteHint")}
      </p>

      {showSuccess ? (
        <div className="app-modal-layer fixed inset-0 z-[1320] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
          <div className="app-modal-backdrop absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" />
          <div className="relative w-full max-w-sm animate-fade rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#eff6ff)] px-5 py-4 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{inviteSuccessMessage}</p>
                <p className="text-xs text-slate-600">{closingMessage}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
