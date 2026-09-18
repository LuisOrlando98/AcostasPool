"use client";

import { useId, useState } from "react";
import AppModal from "@/components/ui/AppModal";
import ContractInPersonSignForm from "@/components/contracts/ContractInPersonSignForm";
import { useI18n } from "@/i18n/client";

type ContractViewerModalProps = {
  contractId: string;
  customerId: string;
  customerName: string;
  /** "Contrato de <mes> <año>", ya formateado en la zona horaria del negocio. */
  periodLabel: string;
  isSigned: boolean;
  /** Frase de firma ya compuesta en servidor (fecha + vía), o null si no está firmado. */
  signedSummary: string | null;
  pdfHref: string;
  triggerLabel: string;
  signAction: (formData: FormData) => Promise<void>;
};

const MODAL_Z_INDEX_CLASS = "z-[2200]";
const LAYER_CLASS = "overflow-y-auto p-3 sm:p-6";
const CARD_CLASS =
  "flex max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl";

/**
 * Visor del contrato vigente con firma presencial. Sustituye al modal CSS-only
 * (`#view-contract` + `peer-checked`) por AppModal: el disparador es un botón
 * real y el diálogo gestiona foco, Escape e `inert`.
 */
export default function ContractViewerModal({
  contractId,
  customerId,
  customerName,
  periodLabel,
  isSigned,
  signedSummary,
  pdfHref,
  triggerLabel,
  signAction,
}: ContractViewerModalProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeLabel = t("common.actions.close");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="cursor-pointer rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
      >
        {triggerLabel}
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        titleId={titleId}
        zIndexClass={MODAL_Z_INDEX_CLASS}
        layerClassName={LAYER_CLASS}
        cardClassName={CARD_CLASS}
      >
        <div className="app-modal-scroll modal-scroll flex-1 overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
          <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {t("admin.customers.detail.sections.contractTitle")}
              </p>
              <h2 id={titleId} className="text-lg font-semibold">
                {periodLabel}
              </h2>
              <p className="text-sm text-slate-500">{customerName}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="app-modal-close"
              aria-label={closeLabel}
              title={closeLabel}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 6l12 12M18 6l-12 12"
                />
              </svg>
            </button>
          </div>

          <div className="mt-5 flex h-[64vh] min-h-[440px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <iframe
              src={pdfHref}
              title={t("admin.customers.detail.contract.documentPreview")}
              className="w-full flex-1 border-0 bg-white"
            />
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2.5">
              <p className="text-xs text-slate-500">
                {t("admin.customers.detail.contract.previewHint")}
              </p>
              <a
                href={pdfHref}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-sky-700 hover:underline"
              >
                {t("admin.customers.detail.contract.openNewTab")}
              </a>
            </div>
          </div>

          {isSigned ? (
            <p className="mt-4 text-xs text-slate-500">{signedSummary}</p>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">
                {t("admin.customers.detail.contract.inPersonTitle")}
              </p>
              <ContractInPersonSignForm
                action={signAction}
                contractId={contractId}
                customerId={customerId}
                hint={t("admin.customers.detail.contract.inPersonHint")}
                clearLabel={t("admin.customers.detail.contract.clearSignature")}
                submitIdleLabel={t("admin.customers.detail.contract.signAction")}
                submitPendingLabel={t("admin.customers.detail.contract.signing")}
                missingSignatureLabel={t(
                  "admin.customers.detail.contract.missingSignature"
                )}
              />
            </div>
          )}
        </div>
      </AppModal>
    </>
  );
}
