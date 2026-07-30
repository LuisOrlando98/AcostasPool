"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { useI18n } from "@/i18n/client";
import { roundCurrency } from "@/lib/invoices/line-items";
import { formatInBusinessTimeZone } from "@/lib/timezone";

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE";
type InvoiceTheme = "STANDARD" | "SPECIAL" | "ESTIMATE";

type JobOption = {
  id: string;
  scheduledDate: string;
  technicianName?: string | null;
};

type LineItem = {
  label: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

type LineDraft = {
  id: string;
  label: string;
  quantity: string;
  unitPrice: string;
};

type Props = {
  invoiceId: string;
  defaultNumber: string;
  defaultStatus: InvoiceStatus;
  defaultTheme: InvoiceTheme;
  defaultJobId?: string | null;
  defaultNotes?: string | null;
  defaultTax: number;
  jobs: JobOption[];
  initialLineItems: LineItem[];
  locked: boolean;
  updateInvoiceAction: (formData: FormData) => Promise<{ error?: string } | undefined>;
};

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function makeLine(initial?: Partial<LineItem>): LineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label: initial?.label ?? "",
    quantity: String(initial?.quantity ?? 1),
    unitPrice: String(initial?.unitPrice ?? ""),
  };
}

export default function InvoiceEditForm({
  invoiceId,
  defaultNumber,
  defaultStatus,
  defaultTheme,
  defaultJobId,
  defaultNotes,
  defaultTax,
  jobs,
  initialLineItems,
  locked,
  updateInvoiceAction,
}: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [lines, setLines] = useState<LineDraft[]>(
    initialLineItems.length > 0
      ? initialLineItems.map((line) => makeLine(line))
      : [makeLine()]
  );
  const [taxExempt, setTaxExempt] = useState(defaultTax <= 0);
  const [error, setError] = useState<string | null>(null);

  const normalizedLines = useMemo(
    () =>
      lines
        .map((line) => {
          const label = line.label.trim();
          const quantity = Math.max(1, toNumber(line.quantity, 1));
          const unitPrice = Math.max(0, toNumber(line.unitPrice, 0));
          const amount = roundCurrency(quantity * unitPrice);
          return {
            label,
            quantity,
            unitPrice,
            amount,
          };
        })
        .filter((line) => line.label.length > 0),
    [lines]
  );

  const subtotal = useMemo(
    () => roundCurrency(normalizedLines.reduce((sum, line) => sum + line.amount, 0)),
    [normalizedLines]
  );
  const taxAmount = taxExempt ? 0 : roundCurrency(subtotal * 0.07);
  const total = roundCurrency(subtotal + taxAmount);
  const lineItemsJson = useMemo(() => JSON.stringify(normalizedLines), [normalizedLines]);

  const money = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await updateInvoiceAction(formData);
        if (result?.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="tax" value={taxAmount.toFixed(2)} />
      <input type="hidden" name="lineItemsJson" value={lineItemsJson} />

      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t("admin.invoices.list.table.invoice")}
          </span>
          <input
            name="number"
            defaultValue={defaultNumber}
            className="app-input mt-2 w-full px-4 py-3 text-sm"
            disabled={locked}
            required
          />
        </label>
        <label>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t("admin.invoices.list.table.status")}
          </span>
          <select
            name="status"
            defaultValue={defaultStatus}
            className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
            disabled={locked}
          >
            <option value="DRAFT">{t("admin.invoices.status.draft")}</option>
            <option value="SENT">{t("admin.invoices.status.sent")}</option>
            <option value="PAID">{t("admin.invoices.status.paid")}</option>
            <option value="OVERDUE">{t("admin.invoices.status.overdue")}</option>
          </select>
        </label>
        <label>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t("admin.invoices.list.type")}
          </span>
          <select
            name="type"
            defaultValue={defaultTheme}
            className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
            disabled={locked}
          >
            <option value="STANDARD">{t("admin.invoices.theme.standard")}</option>
            <option value="SPECIAL">{t("admin.invoices.theme.special")}</option>
            <option value="ESTIMATE">{t("admin.invoices.theme.estimate")}</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t("admin.invoices.new.fields.job")}
          </span>
          <select
            name="jobId"
            defaultValue={defaultJobId ?? ""}
            className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
            disabled={locked}
          >
            <option value="">{t("admin.invoices.list.noJob")}</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {formatInBusinessTimeZone(job.scheduledDate, locale, {
                  dateStyle: "short",
                })}{" "}
                -{" "}
                {job.technicianName ?? t("admin.invoices.list.noTech")}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-end">
          <span className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={taxExempt}
              onChange={(event) => setTaxExempt(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
              disabled={locked}
            />
            <span>{t("admin.invoices.new.fields.taxExempt")}</span>
          </span>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {t("admin.invoices.new.fields.items")}
        </p>

        <div className="mt-3 space-y-2">
          {lines.map((line) => {
            const quantity = toNumber(line.quantity, 1);
            const unitPrice = toNumber(line.unitPrice, 0);
            const lineTotal = roundCurrency(Math.max(quantity, 1) * Math.max(unitPrice, 0));

            return (
              <div
                key={line.id}
                className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_92px_120px_auto] sm:items-end"
              >
                <label>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.invoices.new.fields.customService")}
                  </span>
                  <input
                    value={line.label}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLines((current) =>
                        current.map((entry) =>
                          entry.id === line.id ? { ...entry, label: value } : entry
                        )
                      );
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    placeholder={t("admin.invoices.new.placeholders.customService")}
                    disabled={locked}
                  />
                </label>

                <label>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.invoices.new.fields.qty")}
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLines((current) =>
                        current.map((entry) =>
                          entry.id === line.id ? { ...entry, quantity: value } : entry
                        )
                      );
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    disabled={locked}
                  />
                </label>

                <label>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.invoices.new.fields.unitPrice")}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLines((current) =>
                        current.map((entry) =>
                          entry.id === line.id ? { ...entry, unitPrice: value } : entry
                        )
                      );
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    disabled={locked}
                  />
                </label>

                <div className="flex items-center justify-between gap-2 sm:block">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.invoices.new.fields.lineTotal")}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-900">{money(lineTotal)}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setLines((current) =>
                        current.length > 1
                          ? current.filter((entry) => entry.id !== line.id)
                          : current
                      )
                    }
                    disabled={locked || lines.length <= 1}
                    className="mt-2 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("admin.invoices.new.actions.removeLine")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setLines((current) => [...current, makeLine()])}
          disabled={locked}
          className="mt-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("admin.invoices.new.actions.addLine")}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-1 text-sm text-slate-600">
          <p className="flex items-center justify-between">
            <span>{t("admin.invoices.new.summary.subtotal")}</span>
            <strong className="text-slate-900">{money(subtotal)}</strong>
          </p>
          <p className="flex items-center justify-between">
            <span>{t("admin.invoices.new.summary.tax", { rate: "7" })}</span>
            <strong className="text-slate-900">{money(taxAmount)}</strong>
          </p>
          <p className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
            <span>{t("admin.invoices.new.summary.total")}</span>
            <span>{money(total)}</span>
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t("common.labels.notes")}
        </label>
        <textarea
          name="notes"
          defaultValue={defaultNotes ?? ""}
          className="app-input mt-2 min-h-[90px] w-full px-4 py-3 text-sm"
          disabled={locked}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!locked ? (
        <FormSubmitButton
          idleLabel={t("admin.invoices.editor.actions.saveRegenerate")}
          pendingLabel={t("admin.invoices.editor.actions.saving")}
          successLabel={t("admin.invoices.editor.actions.updated")}
          className="w-full px-4 py-3"
        />
      ) : null}
    </form>
  );
}
