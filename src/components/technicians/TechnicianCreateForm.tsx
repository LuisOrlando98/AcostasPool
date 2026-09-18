"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/client";

type FieldName = "firstName" | "lastName" | "email" | "phone" | "colorHex" | "notes";

type FieldErrors = Partial<Record<FieldName, string>>;

export type CreateTechnicianResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldErrors;
};

export type CreateTechnicianAction = (
  formData: FormData
) => Promise<CreateTechnicianResult>;

type Props = {
  readonly createTechnicianAction: CreateTechnicianAction;
  /** Se invoca cuando termina el aviso de éxito (el contenedor cierra el modal). */
  readonly onCreated?: () => void;
};

const SUCCESS_NOTICE_MS = 2200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_CALENDAR_COLOR = "#38bdf8";
const FORM_MESSAGES_PREFIX = "admin.technicians.newTech.form";
const LABEL_CLASS = "text-xs font-semibold uppercase tracking-wider text-slate-500";
const FIELD_ERROR_CLASS = "mt-1 text-xs font-medium text-rose-600";
const INVALID_INPUT_CLASS =
  "border-rose-400 focus:border-rose-500 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.16)]";

/** Mensajes literales de la server action traducidos a claves i18n. */
const SERVER_FIELD_ERROR_KEYS: Readonly<Record<string, string>> = {
  Required: `${FORM_MESSAGES_PREFIX}.required`,
  "Invalid phone format": `${FORM_MESSAGES_PREFIX}.invalidPhone`,
  "Email already in use": `${FORM_MESSAGES_PREFIX}.emailInUse`,
};
const SERVER_FORM_ERROR_KEYS: Readonly<Record<string, string>> = {
  "Missing required fields": `${FORM_MESSAGES_PREFIX}.completeRequired`,
  "Email already in use": `${FORM_MESSAGES_PREFIX}.emailInUse`,
};

export default function TechnicianCreateForm({
  createTechnicianAction,
  onCreated,
}: Props) {
  const { t } = useI18n();
  const baseId = useId();
  const formRef = useRef<HTMLFormElement | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const requiredMessage = t(`${FORM_MESSAGES_PREFIX}.required`);

  useEffect(
    () => () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    },
    []
  );

  const translateServerError = (
    value: string,
    keys: Readonly<Record<string, string>>
  ) => {
    const key = keys[value];
    return key ? t(key) : value;
  };

  const validateEmail = (email: string) => {
    if (!email) {
      return requiredMessage;
    }
    return EMAIL_PATTERN.test(email)
      ? undefined
      : t(`${FORM_MESSAGES_PREFIX}.invalidEmail`);
  };

  const validateClient = (formData: FormData): FieldErrors => {
    const read = (field: FieldName) => String(formData.get(field) ?? "").trim();
    return {
      firstName: read("firstName") ? undefined : requiredMessage,
      lastName: read("lastName") ? undefined : requiredMessage,
      email: validateEmail(read("email")),
      phone: read("phone") ? undefined : requiredMessage,
    };
  };

  const applyServerErrors = (result: CreateTechnicianResult) => {
    if (result.fieldErrors) {
      const normalizedErrors = Object.fromEntries(
        Object.entries(result.fieldErrors).map(([key, value]) => [
          key,
          value ? translateServerError(value, SERVER_FIELD_ERROR_KEYS) : undefined,
        ])
      ) as FieldErrors;
      setFieldErrors(normalizedErrors);
    }
    setFormError(
      result.error
        ? translateServerError(result.error, SERVER_FORM_ERROR_KEYS)
        : t(`${FORM_MESSAGES_PREFIX}.createError`)
    );
  };

  const scheduleClose = () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = setTimeout(() => {
      formRef.current?.reset();
      setFieldErrors({});
      setShowSuccess(false);
      onCreated?.();
    }, SUCCESS_NOTICE_MS);
  };

  const handleFieldChange = (field: FieldName) => {
    if (!fieldErrors[field]) {
      return;
    }
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const fieldId = (field: FieldName) => `${baseId}-${field}`;
  const fieldErrorId = (field: FieldName) => `${baseId}-${field}-error`;

  const inputClass = (field: FieldName) =>
    `app-input mt-2 w-full px-4 py-3 text-sm ${fieldErrors[field] ? INVALID_INPUT_CLASS : ""}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const clientErrors = validateClient(formData);

    if (Object.values(clientErrors).some(Boolean)) {
      setFieldErrors(clientErrors);
      setFormError(t(`${FORM_MESSAGES_PREFIX}.completeRequired`));
      return;
    }

    setFormError(null);
    setFieldErrors({});
    setPending(true);

    try {
      const result = await createTechnicianAction(formData);
      if (!result.ok) {
        applyServerErrors(result);
        setPending(false);
        return;
      }

      setShowSuccess(true);
      setFormError(null);
      setPending(false);
      scheduleClose();
    } catch {
      setFormError(t(`${FORM_MESSAGES_PREFIX}.unexpectedError`));
      setPending(false);
    }
  };

  const renderTextField = (field: FieldName, labelKey: string, type?: string) => {
    const error = fieldErrors[field];
    return (
      <div>
        <label htmlFor={fieldId(field)} className={LABEL_CLASS}>
          {t(labelKey)}
        </label>
        <input
          id={fieldId(field)}
          name={field}
          type={type}
          onChange={() => handleFieldChange(field)}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? fieldErrorId(field) : undefined}
          className={inputClass(field)}
        />
        {error ? (
          <p id={fieldErrorId(field)} className={FIELD_ERROR_CLASS}>
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        {renderTextField("firstName", "common.labels.firstName")}
        {renderTextField("lastName", "common.labels.lastName")}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {renderTextField("email", "common.labels.email", "email")}
        {renderTextField("phone", "common.labels.phone")}
      </div>

      <div>
        <label htmlFor={fieldId("colorHex")} className={LABEL_CLASS}>
          {t("admin.technicians.newTech.fields.calendarColor")}
        </label>
        <input
          id={fieldId("colorHex")}
          name="colorHex"
          type="color"
          defaultValue={DEFAULT_CALENDAR_COLOR}
          className="mt-2 h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3"
        />
      </div>

      <div>
        <label htmlFor={fieldId("notes")} className={LABEL_CLASS}>
          {t("admin.technicians.newTech.fields.notes")}
        </label>
        <textarea
          id={fieldId("notes")}
          name="notes"
          className="app-input mt-2 min-h-[90px] w-full px-4 py-3 text-sm"
          onChange={() => handleFieldChange("notes")}
        />
      </div>

      {formError ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
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
            <span
              aria-hidden="true"
              className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
            {t("common.feedback.creating")}
          </>
        ) : (
          t("admin.technicians.newTech.actions.create")
        )}
      </button>

      <p className="text-[11px] text-slate-500">
        {t("admin.technicians.newTech.inviteHint")}
      </p>

      {/*
        Aviso transitorio de éxito (no interactivo, se cierra solo): se anuncia
        como región de estado en lugar de convertirlo en un diálogo. No se migra
        a AppModal porque `.app-modal-card` (CSS global sin capa) sobrescribiría
        el aspecto de esta tarjeta y una trampa de foco no aporta nada aquí.
      */}
      {showSuccess ? (
        <div className="app-modal-layer fixed inset-0 z-[1320] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
          <div
            aria-hidden="true"
            className="app-modal-backdrop absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
          />
          <div
            role="status"
            className="relative w-full max-w-sm animate-fade rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#eff6ff)] px-5 py-4 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {t(`${FORM_MESSAGES_PREFIX}.inviteSuccess`)}
                </p>
                <p className="text-xs text-slate-600">
                  {t(`${FORM_MESSAGES_PREFIX}.closing`)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
