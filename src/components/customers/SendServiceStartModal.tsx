"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";

type PlanOption = { id: string; name: string };

type FeeBreakdown = { baseCents: number; feeCents: number; totalCents: number };

type SendServiceStartModalProps = {
  customerId: string;
  customerName: string;
  propertyId: string;
  propertyLabel: string;
  contractId: string | null;
  hasActiveMembership: boolean;
  currentPlanId: string | null;
  currentPlanName: string | null;
  planOptions: PlanOption[];
  feeBreakdown: FeeBreakdown | null;
  paymentDay: number | null;
  triggerLabel: string;
  triggerClassName: string;
  updatePlanAction: (formData: FormData) => Promise<{ error?: string } | undefined>;
  sendAction: (formData: FormData) => Promise<{ error?: string } | undefined>;
};

export default function SendServiceStartModal({
  customerId,
  customerName,
  propertyId,
  propertyLabel,
  contractId,
  hasActiveMembership,
  currentPlanId,
  currentPlanName,
  planOptions,
  feeBreakdown,
  paymentDay,
  triggerLabel,
  triggerClassName,
  updatePlanAction,
  sendAction,
}: SendServiceStartModalProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(currentPlanId ?? "");
  const [planName, setPlanName] = useState(currentPlanName);
  const [planError, setPlanError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSavingPlan, startSavePlan] = useTransition();
  const [isSending, startSend] = useTransition();

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });

  const handlePlanChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPlanId = event.target.value;
    setPlanId(nextPlanId);
    setPlanError(null);
    if (!nextPlanId) {
      return;
    }
    const formData = new FormData();
    formData.set("customerId", customerId);
    formData.set("contractedServiceTierId", nextPlanId);
    startSavePlan(async () => {
      const result = await updatePlanAction(formData);
      if (result?.error) {
        setPlanError(result.error);
        return;
      }
      setPlanName(planOptions.find((option) => option.id === nextPlanId)?.name ?? null);
    });
  };

  const handleSend = () => {
    setSendError(null);
    const formData = new FormData();
    formData.set("customerId", customerId);
    formData.set("propertyId", propertyId);
    formData.set("contractId", contractId ?? "");
    startSend(async () => {
      const result = await sendAction(formData);
      if (result?.error) {
        setSendError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  const hasPlan = Boolean(planId);
  const previewLines: string[] = [];
  if (contractId && !hasActiveMembership) {
    previewLines.push(t("admin.customers.detail.sendStart.preview.signContract"));
    previewLines.push(t("admin.customers.detail.sendStart.preview.activateAutopay"));
  } else if (contractId && hasActiveMembership) {
    previewLines.push(t("admin.customers.detail.sendStart.preview.resignContract"));
  } else {
    previewLines.push(t("admin.customers.detail.sendStart.preview.activateAutopay"));
  }

  const modal =
    typeof document !== "undefined" && open
      ? createPortal(
          <div className="app-modal-layer fixed inset-0 z-[2500] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
              aria-label={t("common.actions.close")}
            />
            <div className="app-modal-card relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {t("admin.customers.detail.sendStart.kicker")}
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {t("admin.customers.detail.sendStart.title")}
                    </h2>
                    <p className="truncate text-sm text-slate-500">{customerName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300"
                    aria-label={t("common.actions.close")}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("admin.customers.detail.sendStart.planLabel")}
                  </p>
                  <select
                    value={planId}
                    onChange={handlePlanChange}
                    disabled={isSavingPlan}
                    className="app-input mt-2 w-full bg-white px-4 py-2.5 text-sm"
                  >
                    <option value="">{t("admin.customers.detail.sendStart.planPlaceholder")}</option>
                    {planOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  {!hasPlan ? (
                    <p className="mt-2 text-xs font-semibold text-amber-700">
                      {t("admin.customers.detail.sendStart.errors.planRequired")}
                    </p>
                  ) : planName ? (
                    <p className="mt-2 text-xs text-emerald-700">
                      {t("admin.customers.detail.sendStart.planSaved", { plan: planName })}
                    </p>
                  ) : null}
                  {planError ? (
                    <p className="mt-2 text-xs font-semibold text-rose-600">{planError}</p>
                  ) : null}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("admin.customers.detail.sendStart.financialsLabel")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{propertyLabel}</p>
                  {feeBreakdown ? (
                    <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>{t("admin.customers.detail.sendStart.baseService")}</span>
                        <span>{currencyFormatter.format(feeBreakdown.baseCents / 100)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("admin.customers.detail.sendStart.fee")}</span>
                        <span>{currencyFormatter.format(feeBreakdown.feeCents / 100)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
                        <span>{t("admin.customers.detail.sendStart.total")}</span>
                        <span>{currencyFormatter.format(feeBreakdown.totalCents / 100)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700">
                      {t("admin.customers.detail.sendStart.noPrice")}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-slate-500">
                    {paymentDay
                      ? t("admin.customers.detail.sendStart.paymentDay", { day: String(paymentDay) })
                      : t("admin.customers.detail.sendStart.noPaymentDay")}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                    {t("admin.customers.detail.sendStart.previewLabel")}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-sky-900">
                    {previewLines.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span>-</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {sendError ? (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {sendError}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={isSending}
                    className="app-button-ghost px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                  >
                    {t("common.actions.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!hasPlan || isSending || isSavingPlan}
                    className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSending
                      ? t("admin.customers.detail.sendStart.sending")
                      : t("admin.customers.detail.sendStart.send")}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>
      {modal}
    </>
  );
}
