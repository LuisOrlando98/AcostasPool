"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { LandingLocale } from "@/components/landing/preferences";

type SelectOption = {
  value: string;
  label: string;
};

type FieldKey = "name" | "email" | "phone" | "city" | "service" | "frequency" | "notes";

type FieldErrors = Partial<Record<FieldKey, string>>;

type ContactFormState = Record<FieldKey, string>;

type SubmitStatus = "idle" | "sending" | "success" | "error";

/** Mirrors the zod schema enforced by /api/contact/quote. */
const FIELD_LIMITS = {
  name: { min: 2, max: 120 },
  email: { max: 180 },
  phone: { max: 40 },
  city: { max: 80 },
  service: { min: 2, max: 120 },
  frequency: { min: 2, max: 80 },
  notes: { max: 2000 },
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED_FIELDS: readonly FieldKey[] = ["name", "email", "service", "frequency"];
const HONEYPOT_FIELD_NAME = "contact_reference";
const STATUS_MESSAGE_ID = "contact-form-status";
const QUOTE_ENDPOINT = "/api/contact/quote";

/*
 * Field errors are styled with utilities: `.lp-contact-form-grid label` forces
 * uppercase bold text and there is no landing class for inline field errors.
 */
const FIELD_ERROR_CLASS =
  "normal-case tracking-normal text-[0.72rem] font-semibold text-[#b33b3b] [[data-theme=night]_&]:text-[#ff9b9b]";
const HONEYPOT_WRAPPER_CLASS = "absolute -left-[9999px] top-auto h-px w-px overflow-hidden";

const FORM_COPY: Record<
  LandingLocale,
  {
    title: string;
    subtitle: string;
    labels: Record<FieldKey, string>;
    notesPlaceholder: string;
    serviceOptions: SelectOption[];
    frequencyOptions: SelectOption[];
    actions: {
      send: string;
      sending: string;
    };
    feedback: {
      success: string;
      sendError: string;
      reviewFields: string;
    };
    errors: Record<FieldKey, string>;
  }
> = {
  en: {
    title: "Send us your request",
    subtitle: "No email app needed. Submit here and we will reply to your inbox.",
    labels: {
      name: "Full name",
      email: "Email",
      phone: "Phone",
      city: "City",
      service: "Service",
      frequency: "Frequency",
      notes: "Notes",
    },
    notesPlaceholder: "Tell us your pool condition, goals, or repair concerns.",
    serviceOptions: [
      { value: "One-Month Pool Cleaning", label: "One-Month Pool Cleaning" },
      { value: "Regular Maintenance", label: "Regular Maintenance" },
      { value: "Pool Cleaning + Leak Detection", label: "Pool Cleaning + Leak Detection" },
      { value: "Pool Repair", label: "Pool Repair" },
    ],
    frequencyOptions: [
      { value: "Weekly", label: "Weekly" },
      { value: "Bi-weekly", label: "Bi-weekly" },
      { value: "Monthly", label: "Monthly" },
      { value: "One-time visit", label: "One-time visit" },
    ],
    actions: {
      send: "Send request",
      sending: "Sending...",
    },
    feedback: {
      success: "Request sent. We will contact you shortly.",
      sendError: "Could not send your request.",
      reviewFields: "Please review the highlighted fields.",
    },
    errors: {
      name: "Enter your full name (at least 2 characters).",
      email: "Enter a valid email address.",
      phone: "Phone must be 40 characters or fewer.",
      city: "City must be 80 characters or fewer.",
      service: "Choose a service.",
      frequency: "Choose a frequency.",
      notes: "Notes must be 2000 characters or fewer.",
    },
  },
  es: {
    title: "Envíanos tu solicitud",
    subtitle: "No necesitas una app de correo. Envía aquí y responderemos a tu bandeja.",
    labels: {
      name: "Nombre completo",
      email: "Correo",
      phone: "Teléfono",
      city: "Ciudad",
      service: "Servicio",
      frequency: "Frecuencia",
      notes: "Notas",
    },
    notesPlaceholder: "Comparte condición de la piscina, objetivos o necesidades de reparación.",
    serviceOptions: [
      { value: "One-Month Pool Cleaning", label: "Limpieza de piscina por un mes" },
      { value: "Regular Maintenance", label: "Mantenimiento regular" },
      {
        value: "Pool Cleaning + Leak Detection",
        label: "Limpieza de piscina y detección de fugas",
      },
      { value: "Pool Repair", label: "Reparación de piscina" },
    ],
    frequencyOptions: [
      { value: "Weekly", label: "Semanal" },
      { value: "Bi-weekly", label: "Quincenal" },
      { value: "Monthly", label: "Mensual" },
      { value: "One-time visit", label: "Visita única" },
    ],
    actions: {
      send: "Enviar solicitud",
      sending: "Enviando...",
    },
    feedback: {
      success: "Solicitud enviada. Te contactaremos pronto.",
      sendError: "No se pudo enviar tu solicitud.",
      reviewFields: "Revisa los campos marcados.",
    },
    errors: {
      name: "Escribe tu nombre completo (mínimo 2 caracteres).",
      email: "Escribe un correo válido.",
      phone: "El teléfono debe tener 40 caracteres o menos.",
      city: "La ciudad debe tener 80 caracteres o menos.",
      service: "Elige un servicio.",
      frequency: "Elige una frecuencia.",
      notes: "Las notas deben tener 2000 caracteres o menos.",
    },
  },
};

type FormCopy = (typeof FORM_COPY)[LandingLocale];

function getInitialState(language: LandingLocale): ContactFormState {
  const copy = FORM_COPY[language];
  return {
    name: "",
    email: "",
    phone: "",
    city: "",
    service: copy.serviceOptions[0]?.value ?? "One-Month Pool Cleaning",
    frequency: copy.frequencyOptions[0]?.value ?? "Weekly",
    notes: "",
  };
}

function isWithin(value: string, limits: { min?: number; max: number }) {
  const length = value.trim().length;
  return length >= (limits.min ?? 0) && length <= limits.max;
}

/** Client-side mirror of the API validation so errors can be attached to fields. */
function validateForm(form: ContactFormState, copy: FormCopy): FieldErrors {
  const errors: FieldErrors = {};

  if (!isWithin(form.name, FIELD_LIMITS.name)) {
    errors.name = copy.errors.name;
  }
  if (!EMAIL_PATTERN.test(form.email.trim()) || !isWithin(form.email, FIELD_LIMITS.email)) {
    errors.email = copy.errors.email;
  }
  if (!isWithin(form.phone, FIELD_LIMITS.phone)) {
    errors.phone = copy.errors.phone;
  }
  if (!isWithin(form.city, FIELD_LIMITS.city)) {
    errors.city = copy.errors.city;
  }
  if (!isWithin(form.service, FIELD_LIMITS.service)) {
    errors.service = copy.errors.service;
  }
  if (!isWithin(form.frequency, FIELD_LIMITS.frequency)) {
    errors.frequency = copy.errors.frequency;
  }
  if (!isWithin(form.notes, FIELD_LIMITS.notes)) {
    errors.notes = copy.errors.notes;
  }

  return errors;
}

function markRequiredFields(message: string): FieldErrors {
  return Object.fromEntries(REQUIRED_FIELDS.map((key) => [key, message])) as FieldErrors;
}

function focusFirstInvalidField(errors: FieldErrors) {
  const firstInvalid = (Object.keys(errors) as FieldKey[])[0];
  if (!firstInvalid) {
    return;
  }
  document.getElementById(`contact-field-${firstInvalid}`)?.focus();
}

export default function ContactRequestForm({ language = "en" }: { language?: LandingLocale }) {
  const copy = useMemo(() => FORM_COPY[language], [language]);
  const [form, setForm] = useState<ContactFormState>(() => getInitialState(language));
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      service: copy.serviceOptions.some((option) => option.value === prev.service)
        ? prev.service
        : (copy.serviceOptions[0]?.value ?? ""),
      frequency: copy.frequencyOptions.some((option) => option.value === prev.frequency)
        ? prev.frequency
        : (copy.frequencyOptions[0]?.value ?? ""),
    }));
    setStatus("idle");
    setMessage("");
    setFieldErrors({});
  }, [copy]);

  function reportInvalidFields(errors: FieldErrors, statusMessage: string) {
    setFieldErrors(errors);
    setStatus("error");
    setMessage(statusMessage);
    focusFirstInvalidField(errors);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Honeypot filled in: most likely a bot. Pretend success and skip the request.
    if (honeypot.trim()) {
      setStatus("success");
      setMessage(copy.feedback.success);
      return;
    }

    const clientErrors = validateForm(form, copy);
    if (Object.keys(clientErrors).length > 0) {
      reportInvalidFields(clientErrors, copy.feedback.reviewFields);
      return;
    }

    setFieldErrors({});
    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch(QUOTE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source: "contact-page",
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (response.status === 400) {
        // The API rejects the payload without field details: re-run the local
        // rules and, if they pass, flag the required fields for review.
        const serverErrors = validateForm(form, copy);
        const errors =
          Object.keys(serverErrors).length > 0
            ? serverErrors
            : markRequiredFields(copy.feedback.reviewFields);
        reportInvalidFields(errors, payload.error || copy.feedback.sendError);
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || copy.feedback.sendError);
      }

      setStatus("success");
      setMessage(copy.feedback.success);
      setForm(getInitialState(language));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : copy.feedback.sendError);
    }
  }

  function updateField<K extends FieldKey>(key: K, value: ContactFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function fieldA11yProps(key: FieldKey) {
    const hasError = Boolean(fieldErrors[key]);
    return {
      id: `contact-field-${key}`,
      "aria-invalid": hasError ? true : undefined,
      "aria-describedby": hasError ? `contact-error-${key}` : undefined,
    };
  }

  function renderFieldError(key: FieldKey) {
    const error = fieldErrors[key];
    if (!error) {
      return null;
    }
    return (
      <span id={`contact-error-${key}`} className={FIELD_ERROR_CLASS}>
        {error}
      </span>
    );
  }

  return (
    <form className="lp-contact-form" onSubmit={handleSubmit}>
      <div className="lp-contact-form-head">
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </div>

      <div className={HONEYPOT_WRAPPER_CLASS} aria-hidden="true">
        <label htmlFor="contact-field-reference">Reference</label>
        <input
          id="contact-field-reference"
          type="text"
          name={HONEYPOT_FIELD_NAME}
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.currentTarget.value)}
        />
      </div>

      <div className="lp-contact-form-grid">
        <label>
          {copy.labels.name}
          <input
            type="text"
            name="name"
            required
            autoComplete="name"
            maxLength={FIELD_LIMITS.name.max}
            value={form.name}
            onChange={(event) => updateField("name", event.currentTarget.value)}
            {...fieldA11yProps("name")}
          />
          {renderFieldError("name")}
        </label>

        <label>
          {copy.labels.email}
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            maxLength={FIELD_LIMITS.email.max}
            value={form.email}
            onChange={(event) => updateField("email", event.currentTarget.value)}
            {...fieldA11yProps("email")}
          />
          {renderFieldError("email")}
        </label>

        <label>
          {copy.labels.phone}
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            maxLength={FIELD_LIMITS.phone.max}
            value={form.phone}
            onChange={(event) => updateField("phone", event.currentTarget.value)}
            {...fieldA11yProps("phone")}
          />
          {renderFieldError("phone")}
        </label>

        <label>
          {copy.labels.city}
          <input
            type="text"
            name="city"
            autoComplete="address-level2"
            maxLength={FIELD_LIMITS.city.max}
            value={form.city}
            onChange={(event) => updateField("city", event.currentTarget.value)}
            {...fieldA11yProps("city")}
          />
          {renderFieldError("city")}
        </label>

        <label>
          {copy.labels.service}
          <select
            name="service"
            required
            value={form.service}
            onChange={(event) => updateField("service", event.currentTarget.value)}
            {...fieldA11yProps("service")}
          >
            {copy.serviceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {renderFieldError("service")}
        </label>

        <label>
          {copy.labels.frequency}
          <select
            name="frequency"
            required
            value={form.frequency}
            onChange={(event) => updateField("frequency", event.currentTarget.value)}
            {...fieldA11yProps("frequency")}
          >
            {copy.frequencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {renderFieldError("frequency")}
        </label>

        <label className="lp-contact-form-notes">
          {copy.labels.notes}
          <textarea
            name="notes"
            rows={5}
            maxLength={FIELD_LIMITS.notes.max}
            value={form.notes}
            onChange={(event) => updateField("notes", event.currentTarget.value)}
            placeholder={copy.notesPlaceholder}
            {...fieldA11yProps("notes")}
          />
          {renderFieldError("notes")}
        </label>
      </div>

      <div className="lp-contact-form-actions">
        <button type="submit" className="lp-btn lp-btn-primary" disabled={status === "sending"}>
          {status === "sending" ? copy.actions.sending : copy.actions.send}
        </button>
        <p id={STATUS_MESSAGE_ID} aria-live="polite" data-status={status}>
          {message}
        </p>
      </div>
    </form>
  );
}
