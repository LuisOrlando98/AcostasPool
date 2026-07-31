"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { useI18n } from "@/i18n/client";

type PaymentRow = {
  id: string;
  amountCents: number;
  status: string;
  method: string;
  paidAt: string;
  stripePaymentIntentId: string | null;
  recordedByUserId: string | null;
};

type Props = {
  invoiceId: string;
  isPaid: boolean;
  totalCents: number;
  payments: PaymentRow[];
  paymentMethods: readonly string[];
  sendPaymentLinkHref: string;
  recordManualPaymentAction: (
    formData: FormData
  ) => Promise<{ error?: string } | undefined>;
};

export default function InvoicePaymentsPanel({
  invoiceId,
  isPaid,
  totalCents,
  payments,
  paymentMethods,
  sendPaymentLinkHref,
  recordManualPaymentAction,
}: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const money = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);

  const paidSoFarCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const remainingCents = Math.max(0, totalCents - paidSoFarCents);

  return (
    <div className="app-card p-6 shadow-contrast">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">
          {t("admin.invoices.payments.title")}
        </h3>
        {!isPaid ? (
          <a
            href={sendPaymentLinkHref}
            target="_blank"
            rel="noreferrer"
            className="app-button-secondary px-3 py-1.5 text-xs font-semibold"
          >
            {t("admin.invoices.payments.sendLink")}
          </a>
        ) : null}
      </div>

      {!isPaid && paidSoFarCents > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {t("admin.invoices.payments.remaining", { amount: money(remainingCents) })}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">
            {t("admin.invoices.payments.empty")}
          </p>
        ) : (
          payments.map((payment) => (
            <div
              key={payment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">
                  {money(payment.amountCents)}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    ({payment.method}
                    {payment.stripePaymentIntentId ? " - Stripe" : ""})
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(payment.paidAt).toLocaleString(locale)}
                </p>
              </div>
              <span
                className="app-chip px-2.5 py-0.5 text-[11px] font-semibold"
                data-tone={payment.status === "REFUNDED" ? "danger" : "success"}
              >
                {payment.status}
              </span>
            </div>
          ))
        )}
      </div>

      {!isPaid ? (
        <form
          action={async (formData) => {
            setError(null);
            const result = await recordManualPaymentAction(formData);
            if (result?.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          }}
          className="mt-4 space-y-3 border-t border-slate-200 pt-4"
        >
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("admin.invoices.payments.recordManual")}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.invoices.payments.fields.amount")}
              </span>
              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                required
                className="app-input mt-2 w-full px-4 py-2.5 text-sm"
              />
            </label>
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.invoices.payments.fields.method")}
              </span>
              <select
                name="method"
                className="app-input mt-2 w-full bg-white px-4 py-2.5 text-sm"
                defaultValue={paymentMethods[0]}
              >
                {paymentMethods.map((value) => (
                  <option key={value} value={value}>
                    {t(`admin.customers.detail.financials.paymentMethods.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <FormSubmitButton
                idleLabel={t("admin.invoices.payments.recordManual")}
                pendingLabel={t("admin.invoices.editor.actions.saving")}
                successLabel={t("admin.invoices.payments.recorded")}
                className="w-full px-4 py-2.5"
              />
            </div>
          </div>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
