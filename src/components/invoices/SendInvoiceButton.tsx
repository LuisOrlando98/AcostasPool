"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

type SendInvoiceButtonProps = {
  invoiceId: string;
  disabled?: boolean;
};

export default function SendInvoiceButton({
  invoiceId,
  disabled,
}: SendInvoiceButtonProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSend = async () => {
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/invoices/${invoiceId}/send`, {
      method: "POST",
    });
    if (!res.ok) {
      setMessage(t("admin.invoices.send.error"));
      setLoading(false);
      return;
    }
    setMessage(t("admin.invoices.send.success"));
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || loading}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? t("admin.invoices.send.loading") : t("admin.invoices.send.submit")}
      </button>
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </div>
  );
}
