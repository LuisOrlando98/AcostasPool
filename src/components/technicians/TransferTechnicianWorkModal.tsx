"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { formatInBusinessTimeZone } from "@/lib/timezone";

type TechnicianOption = {
  id: string;
  name: string;
  isActive: boolean;
  colorHex?: string | null;
  transferableJobs: number;
  activePlans: number;
  upcomingJobs: Array<{ date: string; label: string }>;
};

type TransferResult = { error?: string; jobsMoved?: number; plansMoved?: number };

type TransferTechnicianWorkModalProps = {
  technicians: TechnicianOption[];
  transferAction: (formData: FormData) => Promise<TransferResult>;
};

function TechnicianDot({ colorHex }: { colorHex?: string | null }) {
  return (
    <span
      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
      style={{ backgroundColor: colorHex || "#94a3b8" }}
    />
  );
}

export default function TransferTechnicianWorkModal({
  technicians,
  transferAction,
}: TransferTechnicianWorkModalProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [deactivateSource, setDeactivateSource] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ jobsMoved: number; plansMoved: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const fromTech = technicians.find((tech) => tech.id === fromId) ?? null;
  const toTech = technicians.find((tech) => tech.id === toId) ?? null;
  const toOptions = useMemo(
    () => technicians.filter((tech) => tech.id !== fromId),
    [technicians, fromId]
  );
  const canContinue = Boolean(fromTech && toTech && fromTech.id !== toTech.id);
  const confirmMatches =
    fromTech !== null && confirmText.trim().toLowerCase() === fromTech.name.trim().toLowerCase();

  const resetAndClose = () => {
    setOpen(false);
    setStep("select");
    setFromId("");
    setToId("");
    setDeactivateSource(true);
    setConfirmText("");
    setError(null);
    setResult(null);
  };

  const goToConfirm = () => {
    if (!canContinue) {
      return;
    }
    setError(null);
    setConfirmText("");
    setStep("confirm");
  };

  const handleSubmit = () => {
    if (!fromTech || !toTech || !confirmMatches) {
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

  const renderTechCard = (tech: TechnicianOption, tone: "from" | "to") => (
    <div
      className={`mt-3 rounded-2xl border p-4 ${
        tone === "from" ? "border-rose-200 bg-rose-50/60" : "border-emerald-200 bg-emerald-50/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <TechnicianDot colorHex={tech.colorHex} />
        <p className="text-sm font-semibold text-slate-900">{tech.name}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="app-chip px-2.5 py-1 text-[11px]" data-tone="neutral">
          {t("admin.technicians.transfer.jobsCount", { count: tech.transferableJobs })}
        </span>
        <span className="app-chip px-2.5 py-1 text-[11px]" data-tone="neutral">
          {t("admin.technicians.transfer.plansCount", { count: tech.activePlans })}
        </span>
      </div>
      {tone === "from" && tech.upcomingJobs.length > 0 ? (
        <div className="mt-3 border-t border-rose-200/70 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
            {t("admin.technicians.transfer.upcomingLabel")}
          </p>
          <ul className="mt-1.5 space-y-1">
            {tech.upcomingJobs.map((job, index) => (
              <li key={index} className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">
                  {formatInBusinessTimeZone(new Date(job.date), locale, { dateStyle: "short" })}
                </span>{" "}
                - {job.label}
              </li>
            ))}
          </ul>
          {tech.transferableJobs > tech.upcomingJobs.length ? (
            <p className="mt-1.5 text-[11px] text-slate-500">
              {t("admin.technicians.transfer.upcomingMore", {
                count: tech.transferableJobs - tech.upcomingJobs.length,
              })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

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
            <div className="app-modal-card relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
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
                ) : step === "select" ? (
                  <>
                    <div className="mt-5 space-y-1">
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
                      {fromTech ? renderTechCard(fromTech, "from") : null}
                    </div>

                    <div className="mt-5">
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
                      {toTech ? renderTechCard(toTech, "to") : null}
                    </div>

                    <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
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

                    <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={resetAndClose}
                        className="app-button-ghost px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                      >
                        {t("common.actions.cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={goToConfirm}
                        disabled={!canContinue}
                        className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("admin.technicians.transfer.continue")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4">
                      <div className="flex items-start gap-3">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-amber-900">
                            {t("admin.technicians.transfer.confirm.title")}
                          </p>
                          <p className="mt-1 text-sm text-amber-800">
                            {t("admin.technicians.transfer.confirm.body", {
                              from: fromTech?.name ?? "",
                              to: toTech?.name ?? "",
                            })}
                          </p>
                        </div>
                      </div>

                      <ul className="mt-3 space-y-1.5 border-t border-amber-200 pt-3 text-sm text-amber-900">
                        <li>
                          {t("admin.technicians.transfer.confirm.jobsLine", {
                            count: fromTech?.transferableJobs ?? 0,
                          })}
                        </li>
                        <li>
                          {t("admin.technicians.transfer.confirm.plansLine", {
                            count: fromTech?.activePlans ?? 0,
                          })}
                        </li>
                        {deactivateSource ? (
                          <li>
                            {t("admin.technicians.transfer.confirm.deactivateLine", {
                              name: fromTech?.name ?? "",
                            })}
                          </li>
                        ) : null}
                      </ul>
                    </div>

                    <div className="mt-5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("admin.technicians.transfer.confirm.typeLabel", {
                          name: fromTech?.name ?? "",
                        })}
                      </label>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(event) => setConfirmText(event.target.value)}
                        placeholder={fromTech?.name ?? ""}
                        className="app-input mt-2 w-full px-4 py-3 text-sm"
                        autoComplete="off"
                      />
                    </div>

                    {error ? (
                      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => setStep("select")}
                        disabled={isPending}
                        className="app-button-ghost px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                      >
                        {t("admin.technicians.transfer.back")}
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!confirmMatches || isPending}
                        className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
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
    </>
  );
}
