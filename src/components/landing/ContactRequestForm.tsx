"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { LandingLocale } from "@/components/landing/preferences";

type SelectOption = {
  value: string;
  label: string;
};

const FORM_COPY: Record<
  LandingLocale,
  {
    title: string;
    subtitle: string;
    labels: {
      name: string;
      email: string;
      phone: string;
      city: string;
      service: string;
      frequency: string;
      notes: string;
    };
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
    };
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
    },
  },
  es: {
    title: "Envianos tu solicitud",
    subtitle: "No necesitas una app de correo. Envia aqui y responderemos a tu bandeja.",
    labels: {
      name: "Nombre completo",
      email: "Correo",
      phone: "Telefono",
      city: "Ciudad",
      service: "Servicio",
      frequency: "Frecuencia",
      notes: "Notas",
    },
    notesPlaceholder: "Comparte condicion de la piscina, objetivos o necesidades de reparacion.",
    serviceOptions: [
      { value: "One-Month Pool Cleaning", label: "Limpieza de piscina por un mes" },
      { value: "Regular Maintenance", label: "Mantenimiento regular" },
      {
        value: "Pool Cleaning + Leak Detection",
        label: "Limpieza de piscina y deteccion de fugas",
      },
      { value: "Pool Repair", label: "Reparacion de piscina" },
    ],
    frequencyOptions: [
      { value: "Weekly", label: "Semanal" },
      { value: "Bi-weekly", label: "Quincenal" },
      { value: "Monthly", label: "Mensual" },
      { value: "One-time visit", label: "Visita unica" },
    ],
    actions: {
      send: "Enviar solicitud",
      sending: "Enviando...",
    },
    feedback: {
      success: "Solicitud enviada. Te contactaremos pronto.",
      sendError: "No se pudo enviar tu solicitud.",
    },
  },
};

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  city: string;
  service: string;
  frequency: string;
  notes: string;
};

type SubmitStatus = "idle" | "sending" | "success" | "error";

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

export default function ContactRequestForm({ language = "en" }: { language?: LandingLocale }) {
  const copy = useMemo(() => FORM_COPY[language], [language]);
  const [form, setForm] = useState<ContactFormState>(() => getInitialState(language));
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");

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
  }, [copy]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch("/api/contact/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source: "contact-page",
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

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

  function updateField<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form className="lp-contact-form" onSubmit={handleSubmit}>
      <div className="lp-contact-form-head">
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </div>

      <div className="lp-contact-form-grid">
        <label>
          {copy.labels.name}
          <input
            type="text"
            name="name"
            required
            autoComplete="name"
            value={form.name}
            onChange={(event) => updateField("name", event.currentTarget.value)}
          />
        </label>

        <label>
          {copy.labels.email}
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(event) => updateField("email", event.currentTarget.value)}
          />
        </label>

        <label>
          {copy.labels.phone}
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => updateField("phone", event.currentTarget.value)}
          />
        </label>

        <label>
          {copy.labels.city}
          <input
            type="text"
            name="city"
            autoComplete="address-level2"
            value={form.city}
            onChange={(event) => updateField("city", event.currentTarget.value)}
          />
        </label>

        <label>
          {copy.labels.service}
          <select
            name="service"
            required
            value={form.service}
            onChange={(event) => updateField("service", event.currentTarget.value)}
          >
            {copy.serviceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          {copy.labels.frequency}
          <select
            name="frequency"
            required
            value={form.frequency}
            onChange={(event) => updateField("frequency", event.currentTarget.value)}
          >
            {copy.frequencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="lp-contact-form-notes">
          {copy.labels.notes}
          <textarea
            name="notes"
            rows={5}
            value={form.notes}
            onChange={(event) => updateField("notes", event.currentTarget.value)}
            placeholder={copy.notesPlaceholder}
          />
        </label>
      </div>

      <div className="lp-contact-form-actions">
        <button type="submit" className="lp-btn lp-btn-primary" disabled={status === "sending"}>
          {status === "sending" ? copy.actions.sending : copy.actions.send}
        </button>
        <p aria-live="polite" data-status={status}>
          {message}
        </p>
      </div>
    </form>
  );
}
