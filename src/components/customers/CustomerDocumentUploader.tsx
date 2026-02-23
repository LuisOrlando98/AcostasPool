"use client";

import { useState } from "react";

type CustomerDocumentUploaderProps = {
  customerId: string;
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  compact?: boolean;
  onUploaded?: () => void;
};

const CATEGORY_OPTIONS = [
  { value: "GENERAL", label: "General" },
  { value: "CONTRACT", label: "Contract" },
  { value: "REPORT", label: "Report" },
  { value: "INVOICE_ATTACHMENT", label: "Invoice attachment" },
  { value: "PHOTO", label: "Photo" },
];

export default function CustomerDocumentUploader({
  customerId,
  title = "Upload documents",
  subtitle = "Files are stored inside this customer repository.",
  buttonLabel = "Upload files",
  compact = false,
  onUploaded,
}: CustomerDocumentUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleSubmit = async () => {
    if (files.length === 0) {
      setIsError(true);
      setMessage("Select at least one document.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("category", category);
    if (description.trim()) {
      formData.append("description", description.trim());
    }

    const response = await fetch(`/api/customers/${customerId}/documents`, {
      method: "POST",
      body: formData,
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setIsError(true);
      setMessage(data.error ?? "Unable to upload documents.");
      setLoading(false);
      return;
    }

    setMessage("Documents uploaded successfully.");
    setFiles([]);
    setDescription("");
    setLoading(false);

    if (onUploaded) {
      onUploaded();
      return;
    }

    window.location.reload();
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-slate-50 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Category
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Description (optional)
            </span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="app-input mt-2 w-full px-4 py-3 text-sm"
              placeholder="Internal note for this upload"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Files
          </span>
          <input
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
          />
        </label>

        {files.length > 0 ? (
          <ul className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>{file.name}</li>
            ))}
          </ul>
        ) : null}

        {message ? (
          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
              isError
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="app-button-primary w-full px-4 py-3 text-sm font-semibold disabled:opacity-70"
        >
          {loading ? "Uploading..." : buttonLabel}
        </button>
      </div>
    </div>
  );
}
