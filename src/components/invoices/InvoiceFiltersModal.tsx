"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import AppModal from "@/components/ui/AppModal";
import { useI18n } from "@/i18n/client";

type Props = {
  /** Formulario GET de filtros (server component): se renderiza dentro de la card. */
  readonly children: ReactNode;
};

const Z_INDEX_CLASS = "z-[2200]";
const LAYER_CLASS = "overflow-y-auto p-3 sm:p-6";
const CARD_CLASS =
  "max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl";
const TRIGGER_CLASS =
  "app-button-ghost inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full p-0";
const CLOSE_BUTTON_CLASS =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300";

/**
 * Botón real de apertura + modal accesible para los filtros de facturas.
 * Sustituye al patrón CSS-only (`input#invoice-filters` + `<label>`), que no
 * era operable con teclado; el formulario y sus query params no cambian.
 */
export default function InvoiceFiltersModal({ children }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openLabel = t("admin.invoices.filters.open");
  const closeLabel = t("common.actions.close");
  const closeModal = () => setOpen(false);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={openLabel}
        title={openLabel}
        className={TRIGGER_CLASS}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
        </svg>
      </button>

      <AppModal
        open={open}
        onClose={closeModal}
        titleId={titleId}
        zIndexClass={Z_INDEX_CLASS}
        layerClassName={LAYER_CLASS}
        cardClassName={CARD_CLASS}
        returnFocusRef={triggerRef}
      >
        <div className="app-modal-scroll modal-scroll max-h-[90dvh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
          <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {openLabel}
              </p>
              <h2 id={titleId} className="text-lg font-semibold">
                {t("admin.invoices.filters.modalTitle")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("admin.invoices.filters.modalSubtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              aria-label={closeLabel}
              title={closeLabel}
              className={CLOSE_BUTTON_CLASS}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>
          </div>

          {children}
        </div>
      </AppModal>
    </>
  );
}
