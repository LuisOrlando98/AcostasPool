"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/client";
import { CUSTOMER_TRANSFER_FORMAT } from "@/lib/customers/transfer";

type ImportSummary = {
  totalEntries: number;
  createdCustomers: number;
  skippedCustomers: number;
  createdProperties: number;
  skippedProperties: number;
  errorCount: number;
};

type ImportIssue = {
  customer: string;
  message: string;
};

type ImportResultState =
  | {
      tone: "success" | "warning";
      message: string;
      summary: ImportSummary;
      issues: ImportIssue[];
    }
  | {
      tone: "error";
      message: string;
      details: string[];
    };

export default function CustomerTransferPanel() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResultState | null>(null);

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setResult({
        tone: "error",
        message: t("admin.developer.customerTransfer.errors.missingFile"),
        details: [],
      });
      return;
    }

    setPending(true);
    setResult(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(
        "/api/admin/developer/customers-transfer/import",
        {
          method: "POST",
          body,
        }
      );

      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            summary?: ImportSummary;
            issues?: ImportIssue[];
            error?: string;
            details?: string[];
          }
        | null;

      if (!response.ok || !data?.summary) {
        setResult({
          tone: "error",
          message:
            data?.error ??
            t("admin.developer.customerTransfer.errors.invalidResponse"),
          details: data?.details ?? [],
        });
        return;
      }

      const issues = Array.isArray(data.issues) ? data.issues : [];
      const hasIssues =
        data.summary.errorCount > 0 ||
        data.summary.skippedCustomers > 0 ||
        data.summary.skippedProperties > 0 ||
        issues.length > 0;

      setResult({
        tone: hasIssues ? "warning" : "success",
        message: hasIssues
          ? t("admin.developer.customerTransfer.status.partial")
          : t("admin.developer.customerTransfer.status.success"),
        summary: data.summary,
        issues,
      });
    } catch {
      setResult({
        tone: "error",
        message: t("admin.developer.customerTransfer.status.error"),
        details: [],
      });
    } finally {
      setPending(false);
    }
  };

  const resultToneClass =
    result?.tone === "success"
      ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
      : result?.tone === "warning"
        ? "border-amber-200 bg-amber-50/90 text-amber-900"
        : "border-rose-200 bg-rose-50/90 text-rose-900";

  return (
    <section className="app-card p-5 shadow-contrast sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
            {t("admin.developer.customerTransfer.title")}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {t("admin.developer.customerTransfer.subtitle")}
          </h2>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("admin.developer.customerTransfer.formatLabel")}
          </p>
          <code className="mt-1 block text-xs text-slate-700">
            {CUSTOMER_TRANSFER_FORMAT}
          </code>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            {t("admin.developer.customerTransfer.export.kicker")}
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-900">
            {t("admin.developer.customerTransfer.export.title")}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {t("admin.developer.customerTransfer.export.subtitle")}
          </p>
          <a
            href="/api/admin/developer/customers-transfer/export"
            className="app-button-primary mt-4 inline-flex px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            {t("admin.developer.customerTransfer.export.action")}
          </a>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            {t("admin.developer.customerTransfer.import.kicker")}
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-900">
            {t("admin.developer.customerTransfer.import.title")}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {t("admin.developer.customerTransfer.import.subtitle")}
          </p>

          <form onSubmit={handleImport} className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t("admin.developer.customerTransfer.import.fileLabel")}
              </label>
              <input
                type="file"
                accept="application/json,.json"
                className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.14em] file:text-white"
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
              />
              <p className="mt-2 text-xs text-slate-500">
                {t("admin.developer.customerTransfer.import.fileHint")}
              </p>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="app-button-primary inline-flex px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending
                ? t("admin.developer.customerTransfer.import.pending")
                : t("admin.developer.customerTransfer.import.action")}
            </button>
          </form>
        </article>
      </div>

      {result ? (
        <div className={`mt-5 rounded-3xl border p-5 ${resultToneClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em]">
                {t("admin.developer.customerTransfer.summary.title")}
              </p>
              <p className="mt-1 text-sm font-semibold">{result.message}</p>
            </div>
          </div>

          {"summary" in result ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-current/15 bg-white/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                    {t(
                      "admin.developer.customerTransfer.summary.createdCustomers"
                    )}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {result.summary.createdCustomers}
                  </p>
                </div>
                <div className="rounded-2xl border border-current/15 bg-white/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                    {t(
                      "admin.developer.customerTransfer.summary.skippedCustomers"
                    )}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {result.summary.skippedCustomers}
                  </p>
                </div>
                <div className="rounded-2xl border border-current/15 bg-white/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                    {t(
                      "admin.developer.customerTransfer.summary.createdProperties"
                    )}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {result.summary.createdProperties}
                  </p>
                </div>
                <div className="rounded-2xl border border-current/15 bg-white/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                    {t(
                      "admin.developer.customerTransfer.summary.skippedProperties"
                    )}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {result.summary.skippedProperties}
                  </p>
                </div>
                <div className="rounded-2xl border border-current/15 bg-white/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                    {t("admin.developer.customerTransfer.summary.errors")}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {result.summary.errorCount}
                  </p>
                </div>
              </div>

              {result.issues.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                    {t("admin.developer.customerTransfer.errors.detailsTitle")}
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {result.issues.map((issue, index) => (
                      <li
                        key={`${issue.customer}-${issue.message}-${index}`}
                        className="rounded-2xl border border-current/15 bg-white/60 px-3 py-2"
                      >
                        <span className="font-semibold">{issue.customer}:</span>{" "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : result.details.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {result.details.map((detail, index) => (
                <li
                  key={`${detail}-${index}`}
                  className="rounded-2xl border border-current/15 bg-white/60 px-3 py-2"
                >
                  {detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
