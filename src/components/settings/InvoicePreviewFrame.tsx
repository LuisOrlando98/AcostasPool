"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { InvoiceTemplateTheme } from "@/lib/invoice-template";
import {
  INVOICE_PREVIEW_ROUTE_PATH,
  INVOICE_PREVIEW_THEME_PARAM,
} from "@/lib/invoices/preview-sample";

type InvoicePreviewFrameProps = {
  theme: InvoiceTemplateTheme;
};

type PreviewResult =
  | { requestKey: string; kind: "ready"; pdfUrl: string }
  | { requestKey: string; kind: "error" };

const CACHE_BUST_PARAM = "v";
const PDF_CONTENT_TYPE = "application/pdf";
const FRAME_HEIGHT_CLASS =
  "h-[32rem] sm:h-[38rem] xl:h-[calc(100vh-18rem)] xl:min-h-[28rem]";
const THEME_LABEL_KEYS: Record<InvoiceTemplateTheme, string> = {
  STANDARD: "admin.invoices.theme.standard",
  SPECIAL: "admin.invoices.theme.special",
  ESTIMATE: "admin.invoices.theme.estimate",
};

function buildPreviewRequestUrl(theme: InvoiceTemplateTheme) {
  const params = new URLSearchParams({
    [INVOICE_PREVIEW_THEME_PARAM]: theme,
    [CACHE_BUST_PARAM]: String(Date.now()),
  });
  return `${INVOICE_PREVIEW_ROUTE_PATH}?${params.toString()}`;
}

async function fetchPreviewPdf(theme: InvoiceTemplateTheme, signal: AbortSignal) {
  const response = await fetch(buildPreviewRequestUrl(theme), {
    signal,
    cache: "no-store",
    headers: { Accept: PDF_CONTENT_TYPE },
  });
  if (!response.ok) {
    throw new Error(`Invoice preview request failed with status ${response.status}.`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes(PDF_CONTENT_TYPE)) {
    throw new Error(`Invoice preview returned an unexpected content type: ${contentType}.`);
  }
  return response.blob();
}

function PreviewStatus({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-xs font-semibold text-slate-600"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600"
      />
      <span>{label}</span>
    </div>
  );
}

export default function InvoicePreviewFrame({ theme }: InvoicePreviewFrameProps) {
  const { t } = useI18n();
  const hintId = useId();
  const [refreshCount, setRefreshCount] = useState(0);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const requestKey = `${theme}:${refreshCount}`;
  const currentResult = result && result.requestKey === requestKey ? result : null;
  const isLoading = currentResult === null;
  const hasError = currentResult?.kind === "error";
  // Keep the last rendered PDF visible while a refresh is in flight.
  const pdfUrl = result?.kind === "ready" ? result.pdfUrl : null;

  useEffect(() => {
    const controller = new AbortController();
    fetchPreviewPdf(theme, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) {
          return;
        }
        setResult({ requestKey, kind: "ready", pdfUrl: URL.createObjectURL(blob) });
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setResult({ requestKey, kind: "error" });
      });
    return () => controller.abort();
  }, [theme, requestKey]);

  useEffect(() => {
    if (!pdfUrl) {
      return;
    }
    return () => URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const handleRefresh = () => {
    setRefreshCount((count) => count + 1);
  };

  const frameTitle = t("admin.settings.invoiceEditor.preview.frameTitle", {
    theme: t(THEME_LABEL_KEYS[theme]),
  });
  const loadingLabel = t("admin.settings.invoiceEditor.preview.loading");
  const refreshLabel = t("admin.settings.invoiceEditor.preview.refresh");
  const errorLabel = t("admin.settings.invoiceEditor.preview.error");
  const unsupportedLabel = t("admin.settings.invoiceEditor.preview.unsupported");
  const openLabel = t("admin.settings.invoiceEditor.preview.openInNewTab");

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="app-button-secondary px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {refreshLabel}
        </button>
      </div>

      <div
        aria-busy={isLoading}
        className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white ${FRAME_HEIGHT_CLASS}`}
      >
        {pdfUrl ? (
          <iframe
            key={pdfUrl}
            title={frameTitle}
            src={pdfUrl}
            aria-describedby={hintId}
            className="h-full w-full border-0 bg-white"
          />
        ) : null}

        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <PreviewStatus label={loadingLabel} />
          </div>
        ) : null}

        {hasError ? (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-6 text-center"
          >
            <p className="text-sm text-slate-600">{errorLabel}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="app-button-secondary px-3 py-1.5 text-xs font-semibold"
            >
              {refreshLabel}
            </button>
          </div>
        ) : null}
      </div>

      <p id={hintId} className="text-[11px] text-slate-500">
        {unsupportedLabel}
        {pdfUrl ? (
          <>
            {" "}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sky-700 hover:text-sky-800"
            >
              {openLabel}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}
