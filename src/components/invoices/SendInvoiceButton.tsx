"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

type SendInvoiceButtonProps = {
  invoiceId: string;
  disabled?: boolean;
};

type SendInvoiceResponse = {
  ok?: boolean;
  error?: string;
  warning?: string;
};

const ALREADY_SENT_STATUS = 409;
const ALREADY_SENT_ERROR = "already_sent";
const POST_SEND_FAILED_WARNING = "post_send_failed";

const readResponseBody = async (res: Response): Promise<SendInvoiceResponse> => {
  const data: unknown = await res.json().catch(() => null);
  return data && typeof data === "object" ? (data as SendInvoiceResponse) : {};
};

export default function SendInvoiceButton({
  invoiceId,
  disabled,
}: SendInvoiceButtonProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmResend, setConfirmResend] = useState(false);

  const sendInvoice = async (force: boolean) => {
    setLoading(true);
    setMessage(null);
    setWarning(null);
    setError(null);
    setConfirmResend(false);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await readResponseBody(res);
      if (res.status === ALREADY_SENT_STATUS && data.error === ALREADY_SENT_ERROR) {
        setConfirmResend(true);
        return;
      }
      if (!res.ok) {
        setError(t("admin.invoices.send.error"));
        return;
      }
      setMessage(t("admin.invoices.send.success"));
      if (data.warning === POST_SEND_FAILED_WARNING) {
        setWarning(t("admin.invoices.send.postSendWarning"));
      }
    } catch {
      setError(t("admin.invoices.send.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    void sendInvoice(false);
  };

  const handleConfirmResend = () => {
    void sendInvoice(true);
  };

  const handleCancelResend = () => {
    setConfirmResend(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || loading || confirmResend}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? t("admin.invoices.send.loading") : t("admin.invoices.send.submit")}
      </button>
      {confirmResend ? (
        <span className="flex items-center gap-2 text-xs text-slate-600">
          <span role="status">{t("admin.invoices.send.alreadySent")}</span>
          <button
            type="button"
            onClick={handleConfirmResend}
            disabled={loading}
            className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
          >
            {t("admin.invoices.send.resend")}
          </button>
          <button
            type="button"
            onClick={handleCancelResend}
            disabled={loading}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {t("common.actions.cancel")}
          </button>
        </span>
      ) : null}
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
      {warning ? (
        <span role="status" className="text-xs text-amber-700">
          {warning}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-rose-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
