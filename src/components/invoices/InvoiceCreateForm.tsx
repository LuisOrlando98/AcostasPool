"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { useI18n } from "@/i18n/client";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import { roundCurrency } from "@/lib/invoices/line-items";

type CustomerOption = {
  id: string;
  name: string;
};

type JobOption = {
  id: string;
  customerId: string;
  scheduledDate: string;
  status: string;
  serviceType: string;
  suggestedUnitPrice?: number | null;
};

type InvoiceType = "STANDARD" | "SPECIAL" | "ESTIMATE";

type LineDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

type Props = {
  customers: CustomerOption[];
  jobs: JobOption[];
  createInvoiceAction: (formData: FormData) => Promise<void>;
  onCreated?: () => void;
};

function createLine(initial?: Partial<LineDraft>): LineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description: initial?.description ?? "",
    quantity: initial?.quantity ?? "1",
    unitPrice: initial?.unitPrice ?? "",
  };
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

export default function InvoiceCreateForm({
  customers,
  jobs,
  createInvoiceAction,
  onCreated,
}: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("STANDARD");
  const [taxExempt, setTaxExempt] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([createLine()]);

  const serviceCatalog = useMemo(
    () =>
      serviceTypeOptions.map((option) => ({
        value: option.value,
        label: option.labelKey ? t(option.labelKey) : option.label,
      })),
    [t]
  );

  const jobsByCustomer = useMemo(() => {
    const map = new Map<string, JobOption[]>();
    jobs.forEach((job) => {
      const list = map.get(job.customerId) ?? [];
      list.push(job);
      map.set(job.customerId, list);
    });
    map.forEach((list) =>
      list.sort(
        (a, b) =>
          new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
      )
    );
    return map;
  }, [jobs]);

  const visibleJobs = jobsByCustomer.get(selectedCustomerId) ?? [];

  const jobLabel = (job: JobOption) => {
    const serviceLabel =
      serviceCatalog.find((item) => item.value === job.serviceType)?.label ?? job.serviceType;
    const dateLabel = new Date(job.scheduledDate).toLocaleDateString(locale);
    return `${serviceLabel} - ${dateLabel}`;
  };

  const pickDefaultJob = (customerId: string) => {
    const options = jobsByCustomer.get(customerId) ?? [];
    if (options.length === 0) {
      return "";
    }
    const latestCompleted = options.find((job) => job.status === "COMPLETED");
    return latestCompleted?.id ?? options[0]?.id ?? "";
  };

  const applyJobToFirstLine = (customerId: string, jobId: string) => {
    if (!jobId) {
      return;
    }
    const job = (jobsByCustomer.get(customerId) ?? []).find((entry) => entry.id === jobId);
    if (!job) {
      return;
    }
    const nextDescription = jobLabel(job);
    const nextPrice =
      typeof job.suggestedUnitPrice === "number" && Number.isFinite(job.suggestedUnitPrice)
        ? job.suggestedUnitPrice.toFixed(2)
        : "";

    setLines((current) => {
      if (current.length === 0) {
        return [createLine({ description: nextDescription, unitPrice: nextPrice })];
      }
      const [first, ...rest] = current;
      return [
        {
          ...first,
          description: nextDescription,
          quantity: first.quantity || "1",
          unitPrice: nextPrice,
        },
        ...rest,
      ];
    });
  };

  const suggestedDescriptions = useMemo(() => {
    const options = new Set<string>();
    serviceCatalog.forEach((item) => options.add(item.label));
    visibleJobs.forEach((job) => options.add(jobLabel(job)));
    return [...options];
  }, [serviceCatalog, visibleJobs, locale]);

  const normalizedLines = useMemo(() => {
    return lines
      .map((line) => {
        const label = line.description.trim();
        const quantity = toNumber(line.quantity, 1);
        const unitPrice = toNumber(line.unitPrice, 0);
        const safeQuantity = quantity > 0 ? quantity : 1;
        const safeUnitPrice = unitPrice >= 0 ? unitPrice : 0;
        const amount = roundCurrency(safeQuantity * safeUnitPrice);
        const matchedService = serviceCatalog.find(
          (item) => item.label.toLowerCase() === label.toLowerCase()
        );
        return {
          serviceCode: matchedService?.value ?? null,
          label,
          quantity: safeQuantity,
          unitPrice: safeUnitPrice,
          amount,
        };
      })
      .filter((line) => line.label.length > 0);
  }, [lines, serviceCatalog]);

  const subtotal = useMemo(
    () => roundCurrency(normalizedLines.reduce((sum, line) => sum + line.amount, 0)),
    [normalizedLines]
  );
  const taxAmount = taxExempt ? 0 : roundCurrency(subtotal * 0.07);
  const total = roundCurrency(subtotal + taxAmount);

  const lineItemsJson = useMemo(
    () => JSON.stringify(normalizedLines),
    [normalizedLines]
  );

  const money = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const suggestionsId = "invoice-service-suggestions";

  return (
    <form
      action={async (formData) => {
        await createInvoiceAction(formData);
        onCreated?.();
        router.refresh();
      }}
      className="mt-5"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.new.fields.customer")}
                </span>
                <select
                  name="customerId"
                  value={selectedCustomerId}
                  onChange={(event) => {
                    const nextCustomerId = event.target.value;
                    setSelectedCustomerId(nextCustomerId);
                    if (!nextCustomerId) {
                      setSelectedJobId("");
                      setLines([createLine()]);
                      return;
                    }
                    const defaultJobId = pickDefaultJob(nextCustomerId);
                    setSelectedJobId(defaultJobId);
                    if (defaultJobId) {
                      applyJobToFirstLine(nextCustomerId, defaultJobId);
                    } else {
                      setLines((current) => {
                        if (current.length === 0) {
                          return [createLine()];
                        }
                        const [first, ...rest] = current;
                        return [{ ...first, description: "", unitPrice: "" }, ...rest];
                      });
                    }
                  }}
                  className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                  required
                >
                  <option value="" disabled>
                    --
                  </option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.new.fields.job")}
                </span>
                <select
                  name="jobId"
                  value={selectedJobId}
                  disabled={!selectedCustomerId}
                  onChange={(event) => {
                    const nextJobId = event.target.value;
                    setSelectedJobId(nextJobId);
                    if (selectedCustomerId && nextJobId) {
                      applyJobToFirstLine(selectedCustomerId, nextJobId);
                      return;
                    }
                    setLines((current) => {
                      if (current.length === 0) {
                        return [createLine()];
                      }
                      const [first, ...rest] = current;
                      return [{ ...first, description: "", unitPrice: "" }, ...rest];
                    });
                  }}
                  className="app-input mt-2 w-full bg-white px-4 py-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">{t("admin.invoices.new.fields.noJob")}</option>
                  {visibleJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {jobLabel(job)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.new.fields.type")}
                </span>
                <select
                  name="type"
                  value={invoiceType}
                  onChange={(event) => setInvoiceType(event.target.value as InvoiceType)}
                  className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                >
                  <option value="STANDARD">{t("admin.invoices.theme.standard")}</option>
                  <option value="SPECIAL">{t("admin.invoices.theme.special")}</option>
                  <option value="ESTIMATE">{t("admin.invoices.theme.estimate")}</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("admin.invoices.new.fields.items")}
              </p>
              <button
                type="button"
                onClick={() => setLines((current) => [...current, createLine()])}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
              >
                {t("admin.invoices.new.actions.addLine")}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {lines.map((line) => {
                const quantity = toNumber(line.quantity, 1);
                const unitPrice = toNumber(line.unitPrice, 0);
                const lineTotal = roundCurrency(Math.max(quantity, 1) * Math.max(unitPrice, 0));

                return (
                  <div
                    key={line.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_92px_120px_96px] md:items-end">
                      <label>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {t("admin.invoices.new.fields.description")}
                        </span>
                        <input
                          list={suggestionsId}
                          value={line.description}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((current) =>
                              current.map((entry) =>
                                entry.id === line.id
                                  ? { ...entry, description: value }
                                  : entry
                              )
                            );
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                          placeholder={t("admin.invoices.new.placeholders.description")}
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
                        />
                      </label>

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {t("admin.invoices.new.fields.lineTotal")}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-900">{money(lineTotal)}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setLines((current) =>
                            current.length > 1
                              ? current.filter((entry) => entry.id !== line.id)
                              : current
                          )
                        }
                        disabled={lines.length <= 1}
                        className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("admin.invoices.new.actions.removeLine")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <datalist id={suggestionsId}>
              {suggestedDescriptions.map((description) => (
                <option key={description} value={description} />
              ))}
            </datalist>
          </section>
        </div>

        <aside className="space-y-4">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <input
              type="checkbox"
              name="taxExempt"
              checked={taxExempt}
              onChange={(event) => setTaxExempt(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>{t("admin.invoices.new.fields.taxExempt")}</span>
          </label>

          <input type="hidden" name="lineItemsJson" value={lineItemsJson} />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-1 text-sm text-slate-600">
              <p className="flex items-center justify-between">
                <span>{t("admin.invoices.new.summary.subtotal")}</span>
                <strong className="text-slate-900">{money(subtotal)}</strong>
              </p>
              <p className="flex items-center justify-between">
                <span>
                  {t("admin.invoices.new.summary.tax", {
                    rate: "7",
                  })}
                </span>
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
              className="app-input mt-2 min-h-[100px] w-full px-4 py-3 text-sm"
            />
          </div>

          <FormSubmitButton
            idleLabel={t("admin.invoices.new.actions.create")}
            pendingLabel={t("common.feedback.creating")}
            successLabel={t("common.feedback.created")}
            className="w-full px-4 py-3"
          />
        </aside>
      </div>
    </form>
  );
}
