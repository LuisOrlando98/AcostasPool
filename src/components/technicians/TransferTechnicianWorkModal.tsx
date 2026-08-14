"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { useConfirm } from "@/lib/ui/use-confirm";

type TechnicianOption = {
  id: string;
  name: string;
  isActive: boolean;
  transferableJobs: number;
  activePlans: number;
};

type TransferResult = { error?: string; jobsMoved?: number; plansMoved?: number };

type TransferTechnicianWorkModalProps = {
  technicians: TechnicianOption[];
  transferAction: (formData: FormData) => Promise<TransferResult>;
};

export default function TransferTechnicianWorkModal({
  technicians,
  transferAction,
}: TransferTechnicianWorkModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [deactivateSource, setDeactivateSource] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ jobsMoved: number; plansMoved: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const fromTech = technicians.find((tech) => tech.id === fromId) ?? null;
  const toTech = technicians.find((tech) => tech.id === toId) ?? null;
  const toOptions = useMemo(
    () => technicians.filter((tech) => tech.id !== fromId),
    [technicians, fromId]
  );

  const resetAndClose = () => {
    setOpen(false);
    setFromId("");
    setToId("");
    setDeactivateSource(true);
    setError(null);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!fromTech || !toTech) {
      return;
    }
    const confirmed = await confirm(
      t("admin.technicians.transfer.confirm.body", {
        from: fromTech.name,
        to: toTech.name,
        jobs: fromTech.transferableJobs,
        plans: fromTech.activePlans,
      }),
      {
        title: t("admin.technicians.transfer.confirm.title"),
        confirmLabel: t("admin.technicians.transfer.action"),
      }
    );
    if (!confirmed) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("fromTechnicianId", fromTech.id);
    formData.set("toTechnicianId", toTech.id);
    if (deactivateSource) {
      formData.set("deactivateSource", "on");
    }
    startTransition(async () => {
      const response = await transferAction(formData);
      if (response.error) {
        setError(response.error);
        return;
      }
      setResult({
        jobsMoved: response.jobsMoved ?? 0,
        plansMoved: response.plansMoved ?? 0,
      });
      router.refresh();
    });
  };

  const modal =
    typeof document !== "undefined" && open
      ? createPortal(
          <div className="app-modal-layer fixed inset-0 z-[2200] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            <button
              type="button"
              onClick={resetAndClose}
              className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
              aria-label={t("common.actions.close")}
            />
            <div className="app-modal-card relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {t("admin.technicians.transfer.kicker")}
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {t("admin.technicians.transfer.title")}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {t("admin.technicians.transfer.subtitle")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetAndClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300"
                    aria-label={t("common.actions.close")}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                    </svg>
                  </button>
                </div>

                {result ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                    <p className="font-semibold">{t("admin.technicians.transfer.success.title")}</p>
                    <p className="mt-1">
                      {t("admin.technicians.transfer.success.body", {
                        jobs: result.jobsMoved,
                        plans: result.plansMoved,
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={resetAndClose}
                      className="app-button-primary mt-4 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                    >
                      {t("common.actions.close")}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mt-5 space-y-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.technicians.transfer.from")}
                        </label>
                        <select
                          value={fromId}
                          onChange={(event) => {
                            setFromId(event.target.value);
                            if (event.target.value === toId) {
                              setToId("");
                            }
                          }}
                          className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                        >
                          <option value="">{t("admin.technicians.transfer.selectTechnician")}</option>
                          {technicians.map((tech) => (
                            <option key={tech.id} value={tech.id}>
                              {tech.name}
                            </option>
                          ))}
                        </select>
                        {fromTech ? (
                          <p className="mt-2 text-xs text-slate-500">
                            {t("admin.technicians.transfer.preview", {
                              jobs: fromTech.transferableJobs,
                              plans: fromTech.activePlans,
                            })}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.technicians.transfer.to")}
                        </label>
                        <select
                          value={toId}
                          onChange={(event) => setToId(event.target.value)}
                          disabled={!fromId}
                          className="app-input mt-2 w-full bg-white px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">{t("admin.technicians.transfer.selectTechnician")}</option>
                          {toOptions.map((tech) => (
                            <option key={tech.id} value={tech.id}>
                              {tech.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={deactivateSource}
                          onChange={(event) => setDeactivateSource(event.target.checked)}
                          className="app-toggle"
                        />
                        <span className="text-sm text-slate-700">
                          {fromTech
                            ? t("admin.technicians.transfer.deactivate", { name: fromTech.name })
                            : t("admin.technicians.transfer.deactivateGeneric")}
                        </span>
                      </label>
                    </div>

                    {error ? (
                      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={resetAndClose}
                        disabled={isPending}
                        className="app-button-ghost px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                      >
                        {t("common.actions.cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!fromTech || !toTech || isPending}
                        className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending
                          ? t("admin.technicians.transfer.transferring")
                          : t("admin.technicians.transfer.action")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
      >
        {t("admin.technicians.transfer.trigger")}
      </button>
      {modal}
      {ConfirmDialog}
    </>
  );
}
