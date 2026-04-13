"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { SERVICE_PAYMENT_TYPE_VALUES } from "@/lib/customers/service-payment-info";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

type BillingRow = {
  customerId: string;
  customerName: string;
  serviceStartDate: string | null;
  paymentDay: number | null;
  servicePrice: number | null;
  paymentType: string | null;
  paymentNotes: string | null;
};

type BillingDraft = {
  customerId: string;
  customerName: string;
  serviceStartDate: string;
  paymentDay: string;
  servicePrice: string;
  paymentType: string;
  paymentNotes: string;
};

type AdminBillingTableProps = {
  rows: BillingRow[];
  updateCustomerBillingAction: (formData: FormData) => Promise<void>;
};

function toDraft(row: BillingRow): BillingDraft {
  return {
    customerId: row.customerId,
    customerName: row.customerName,
    serviceStartDate: row.serviceStartDate ?? "",
    paymentDay: row.paymentDay?.toString() ?? "",
    servicePrice:
      row.servicePrice === null ? "" : row.servicePrice.toFixed(2),
    paymentType: row.paymentType ?? "",
    paymentNotes: row.paymentNotes ?? "",
  };
}

export default function AdminBillingTable({
  rows,
  updateCustomerBillingAction,
}: AdminBillingTableProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BillingDraft | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!editing && !confirmOpen) {
      return;
    }
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [editing, confirmOpen]);

  useEffect(() => {
    if (!editing && !confirmOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isPending) {
        return;
      }
      if (confirmOpen) {
        setConfirmOpen(false);
        return;
      }
      setEditing(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, editing, isPending]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
      }),
    [locale]
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    const sorted = [...rows].sort((a, b) =>
      a.customerName.localeCompare(b.customerName)
    );
    if (!normalizedQuery) {
      return sorted;
    }
    return sorted.filter((row) => {
      const paymentTypeLabel = row.paymentType
        ? t(`admin.invoices.servicePayment.paymentTypes.${row.paymentType}`)
        : "";
      const haystack = [
        row.customerName,
        row.serviceStartDate ?? "",
        row.paymentDay?.toString() ?? "",
        row.servicePrice?.toFixed(2) ?? "",
        row.paymentType ?? "",
        paymentTypeLabel,
        row.paymentNotes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [rows, search, t]);

  const openEditor = (row: BillingRow) => {
    setConfirmOpen(false);
    setEditing(toDraft(row));
  };

  const closeEditor = () => {
    if (isPending) {
      return;
    }
    setConfirmOpen(false);
    setEditing(null);
  };

  const saveDraft = () => {
    if (!editing) {
      return;
    }
    const formData = new FormData();
    formData.set("customerId", editing.customerId);
    formData.set("serviceStartDate", editing.serviceStartDate);
    formData.set("paymentDay", editing.paymentDay);
    formData.set("servicePrice", editing.servicePrice);
    formData.set("paymentType", editing.paymentType);
    formData.set("paymentNotes", editing.paymentNotes);

    startTransition(async () => {
      await updateCustomerBillingAction(formData);
      setConfirmOpen(false);
      setEditing(null);
      router.refresh();
    });
  };

  const getDraftPriceLabel = (value: string) => {
    const parsed = Number(value);
    if (!value || !Number.isFinite(parsed)) {
      return t("common.labels.notAvailable");
    }
    return currencyFormatter.format(parsed);
  };

  const formatServiceDate = (value: string | null) => {
    if (!value) {
      return t("common.labels.notAvailable");
    }
    const parsed = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return t("common.labels.notAvailable");
    }
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(parsed);
  };

  const modal =
    typeof document !== "undefined" && editing
      ? createPortal(
          <>
            <div className="app-modal-layer fixed inset-0 z-[2300] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
              <button
                type="button"
                className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
                aria-label={t("common.actions.close")}
                onClick={closeEditor}
              />
              <div className="app-modal-card relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        {t("admin.invoices.servicePayment.modalKicker")}
                      </p>
                      <h2 className="text-lg font-semibold">
                        {t("admin.invoices.servicePayment.modalTitle")}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {editing.customerName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeEditor}
                      disabled={isPending}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={t("common.actions.close")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 6l12 12M18 6l-12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.serviceStartDate")}
                        </label>
                        <input
                          type="date"
                          value={editing.serviceStartDate}
                          onChange={(event) =>
                            setEditing((current) =>
                              current
                                ? {
                                    ...current,
                                    serviceStartDate: event.target.value,
                                  }
                                : current
                            )
                          }
                          className="app-input mt-2 w-full px-4 py-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.paymentDay")}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={editing.paymentDay}
                          onChange={(event) =>
                            setEditing((current) =>
                              current
                                ? { ...current, paymentDay: event.target.value }
                                : current
                            )
                          }
                          className="app-input mt-2 w-full px-4 py-3 text-sm"
                          placeholder={t(
                            "admin.invoices.servicePayment.placeholders.paymentDay"
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.servicePrice")}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editing.servicePrice}
                          onChange={(event) =>
                            setEditing((current) =>
                              current
                                ? { ...current, servicePrice: event.target.value }
                                : current
                            )
                          }
                          className="app-input mt-2 w-full px-4 py-3 text-sm"
                          placeholder={t(
                            "admin.invoices.servicePayment.placeholders.servicePrice"
                          )}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.paymentType")}
                        </label>
                        <select
                          value={editing.paymentType}
                          onChange={(event) =>
                            setEditing((current) =>
                              current
                                ? { ...current, paymentType: event.target.value }
                                : current
                            )
                          }
                          className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                        >
                          <option value="">
                            {t(
                              "admin.invoices.servicePayment.placeholders.paymentType"
                            )}
                          </option>
                          {SERVICE_PAYMENT_TYPE_VALUES.map((value) => (
                            <option key={value} value={value}>
                              {t(
                                `admin.invoices.servicePayment.paymentTypes.${value}`
                              )}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("admin.invoices.servicePayment.fields.paymentNotes")}
                      </label>
                      <textarea
                        value={editing.paymentNotes}
                        onChange={(event) =>
                          setEditing((current) =>
                            current
                              ? { ...current, paymentNotes: event.target.value }
                              : current
                          )
                        }
                        className="app-input mt-2 min-h-[110px] w-full px-4 py-3 text-sm"
                        placeholder={t(
                          "admin.invoices.servicePayment.placeholders.paymentNotes"
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={closeEditor}
                      disabled={isPending}
                      className="app-button-ghost px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                    >
                      {t("common.actions.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      disabled={isPending}
                      className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                    >
                      {t("admin.invoices.servicePayment.actions.reviewSave")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {confirmOpen ? (
              <div className="app-modal-layer fixed inset-0 z-[2400] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
                <button
                  type="button"
                  className="app-modal-backdrop absolute inset-0 bg-slate-900/68"
                  aria-label={t("common.actions.close")}
                  onClick={() => setConfirmOpen(false)}
                />
                <div className="app-modal-card relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                  <div className="p-5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {t("admin.invoices.servicePayment.confirm.kicker")}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      {t("admin.invoices.servicePayment.confirm.title")}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {t("admin.invoices.servicePayment.confirm.subtitle", {
                        customer: editing.customerName,
                      })}
                    </p>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t(
                              "admin.invoices.servicePayment.fields.serviceStartDate"
                            )}
                          </p>
                          <p className="mt-1 text-slate-900">
                            {formatServiceDate(editing.serviceStartDate || null)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.invoices.servicePayment.fields.paymentDay")}
                          </p>
                          <p className="mt-1 text-slate-900">
                            {editing.paymentDay
                              ? t("admin.invoices.servicePayment.dayOfMonth", {
                                  day: editing.paymentDay,
                                })
                              : t("common.labels.notAvailable")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.invoices.servicePayment.fields.servicePrice")}
                          </p>
                          <p className="mt-1 text-slate-900">
                            {getDraftPriceLabel(editing.servicePrice)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.invoices.servicePayment.fields.paymentType")}
                          </p>
                          <p className="mt-1 text-slate-900">
                            {editing.paymentType
                              ? t(
                                  `admin.invoices.servicePayment.paymentTypes.${editing.paymentType}`
                                )
                              : t("common.labels.notAvailable")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("admin.invoices.servicePayment.fields.paymentNotes")}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-slate-900">
                          {editing.paymentNotes.trim() ||
                            t("admin.invoices.servicePayment.emptyNotes")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setConfirmOpen(false)}
                        disabled={isPending}
                        className="app-button-ghost px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                      >
                        {t("admin.invoices.servicePayment.confirm.back")}
                      </button>
                      <button
                        type="button"
                        onClick={saveDraft}
                        disabled={isPending}
                        className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isPending
                          ? t("admin.invoices.servicePayment.actions.saving")
                          : t("admin.invoices.servicePayment.confirm.confirm")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>,
          document.body
        )
      : null;

  return (
    <>
      <section className="app-card p-6 shadow-contrast">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {t("admin.invoices.servicePayment.title")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("admin.invoices.servicePayment.subtitle")}
            </p>
          </div>
          <span className="app-chip px-3 py-1 text-xs" data-tone="info">
            {filteredRows.length}
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <label className="ui-search flex items-center gap-2 px-3 py-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="ui-search-icon h-4 w-4"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 20l-3-3" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("admin.invoices.servicePayment.searchPlaceholder")}
              className="ui-search-input w-full"
            />
          </label>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-[11px] uppercase tracking-[0.14em] text-slate-100/85">
                <tr>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.customer")}
                  </th>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.serviceStartDate")}
                  </th>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.paymentDay")}
                  </th>
                  <th className="px-4 py-3 text-right">
                    {t("admin.invoices.servicePayment.table.price")}
                  </th>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.paymentType")}
                  </th>
                  <th className="px-4 py-3">
                    {t("admin.invoices.servicePayment.table.notes")}
                  </th>
                  <th className="px-4 py-3 text-right">
                    {t("admin.invoices.servicePayment.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                      {t("admin.invoices.servicePayment.empty")}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.customerId} className="transition hover:bg-sky-50/40">
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {row.customerName}
                      </td>
                      <td className="px-4 py-3.5">
                        {formatServiceDate(row.serviceStartDate)}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.paymentDay
                          ? t("admin.invoices.servicePayment.dayOfMonth", {
                              day: String(row.paymentDay),
                            })
                          : t("common.labels.notAvailable")}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                        {row.servicePrice === null
                          ? t("common.labels.notAvailable")
                          : currencyFormatter.format(row.servicePrice)}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.paymentType
                          ? t(
                              `admin.invoices.servicePayment.paymentTypes.${row.paymentType}`
                            )
                          : t("common.labels.notAvailable")}
                      </td>
                      <td className="px-4 py-3.5">
                        <p
                          className="max-w-[22rem] truncate"
                          title={row.paymentNotes ?? ""}
                        >
                          {row.paymentNotes?.trim() ||
                            t("admin.invoices.servicePayment.emptyNotes")}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openEditor(row)}
                          className="ui-button-ghost px-3 py-1.5 text-xs font-semibold"
                        >
                          {t("common.actions.edit")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      {modal}
    </>
  );
}
