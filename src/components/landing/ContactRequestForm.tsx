"use client";

import { useState, type FormEvent } from "react";

const SERVICE_OPTIONS = [
  "Weekly Signature Care",
  "Pool Cleaning",
  "Equipment Repair",
  "Water Testing Service",
];

const FREQUENCY_OPTIONS = ["Weekly", "Bi-weekly", "Monthly", "One-time visit"];

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  city: string;
  service: string;
  frequency: string;
  notes: string;
};

const INITIAL_FORM_STATE: ContactFormState = {
  name: "",
  email: "",
  phone: "",
  city: "",
  service: SERVICE_OPTIONS[0] ?? "Weekly Signature Care",
  frequency: FREQUENCY_OPTIONS[0] ?? "Weekly",
  notes: "",
};

type SubmitStatus = "idle" | "sending" | "success" | "error";

export default function ContactRequestForm() {
  const [form, setForm] = useState<ContactFormState>(INITIAL_FORM_STATE);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");

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
        throw new Error(payload.error || "Could not send your request.");
      }

      setStatus("success");
      setMessage("Request sent. We will contact you shortly.");
      setForm(INITIAL_FORM_STATE);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not send your request.");
    }
  }

  function updateField<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form className="lp-contact-form" onSubmit={handleSubmit}>
      <div className="lp-contact-form-head">
        <h2>Send us your request</h2>
        <p>No email app needed. Submit here and we will reply to your inbox.</p>
      </div>

      <div className="lp-contact-form-grid">
        <label>
          Full name
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
          Email
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
          Phone
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => updateField("phone", event.currentTarget.value)}
          />
        </label>

        <label>
          City
          <input
            type="text"
            name="city"
            autoComplete="address-level2"
            value={form.city}
            onChange={(event) => updateField("city", event.currentTarget.value)}
          />
        </label>

        <label>
          Service
          <select
            name="service"
            required
            value={form.service}
            onChange={(event) => updateField("service", event.currentTarget.value)}
          >
            {SERVICE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Frequency
          <select
            name="frequency"
            required
            value={form.frequency}
            onChange={(event) => updateField("frequency", event.currentTarget.value)}
          >
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="lp-contact-form-notes">
          Notes
          <textarea
            name="notes"
            rows={5}
            value={form.notes}
            onChange={(event) => updateField("notes", event.currentTarget.value)}
            placeholder="Tell us your pool condition, goals, or equipment concerns."
          />
        </label>
      </div>

      <div className="lp-contact-form-actions">
        <button type="submit" className="lp-btn lp-btn-primary" disabled={status === "sending"}>
          {status === "sending" ? "Sending..." : "Send request"}
        </button>
        <p aria-live="polite" data-status={status}>
          {message}
        </p>
      </div>
    </form>
  );
}
