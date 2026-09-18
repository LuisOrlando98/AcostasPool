"use client";

import { useId, type ReactNode } from "react";
import AppModal from "@/components/ui/AppModal";
import { useI18n } from "@/i18n/client";
import {
  useCustomerDetailModal,
  type CustomerDetailModalId,
} from "./CustomerDetailModals";

type CustomerDetailFormModalProps = {
  readonly modal: CustomerDetailModalId;
  readonly kicker: string;
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
};

const MODAL_Z_INDEX_CLASS = "z-[2200]";
const LAYER_CLASS = "overflow-y-auto p-3 sm:p-6";
const CARD_CLASS =
  "max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl";

/**
 * Card común de los modales de formulario de la ficha de cliente: misma capa,
 * card, cabecera (kicker, título, subtítulo) y botón de cierre que tenían los
 * modales CSS-only, ahora sobre AppModal (role="dialog", foco, Escape, inert).
 * El formulario se pasa como `children` y se desmonta al cerrar.
 */
export default function CustomerDetailFormModal({
  modal,
  kicker,
  title,
  subtitle,
  children,
}: CustomerDetailFormModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const { isOpen, close } = useCustomerDetailModal(modal);
  const closeLabel = t("common.actions.close");

  return (
    <AppModal
      open={isOpen}
      onClose={close}
      titleId={titleId}
      zIndexClass={MODAL_Z_INDEX_CLASS}
      layerClassName={LAYER_CLASS}
      cardClassName={CARD_CLASS}
    >
      <div className="app-modal-scroll modal-scroll max-h-[90dvh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
        <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {kicker}
            </p>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={close}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </AppModal>
  );
}
