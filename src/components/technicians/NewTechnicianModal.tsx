"use client";

import { useId, useState } from "react";
import AppModal from "@/components/ui/AppModal";
import TechnicianCreateForm, {
  type CreateTechnicianAction,
} from "@/components/technicians/TechnicianCreateForm";
import { useI18n } from "@/i18n/client";

type Props = {
  readonly createTechnicianAction: CreateTechnicianAction;
};

/**
 * Id del checkbox de compatibilidad. `TechniciansOverview` sigue abriendo el
 * modal con `<label htmlFor="new-tech">`; el checkbox (oculto y controlado)
 * convierte ese clic en estado React. Cuando ese disparador pase a ser un
 * `<button>`, el checkbox puede eliminarse.
 */
export const NEW_TECHNICIAN_TOGGLE_ID = "new-tech";

const Z_INDEX_CLASS = "z-[1300]";
const LAYER_CLASS = "overflow-y-auto p-3 sm:p-6";
const CARD_CLASS =
  "max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-contrast xl:max-w-5xl";
const CLOSE_BUTTON_CLASS =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300";

/**
 * Modal "Nuevo técnico" accesible (AppModal) que sustituye al patrón CSS-only
 * `input#new-tech` + `peer-checked`. Mantiene las mismas clases de card.
 */
export default function NewTechnicianModal({ createTechnicianAction }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeLabel = t("common.actions.close");
  const closeModal = () => setOpen(false);

  return (
    <>
      <input
        id={NEW_TECHNICIAN_TOGGLE_ID}
        type="checkbox"
        className="hidden"
        checked={open}
        onChange={(event) => setOpen(event.target.checked)}
        aria-hidden="true"
        tabIndex={-1}
      />

      <AppModal
        open={open}
        onClose={closeModal}
        titleId={titleId}
        zIndexClass={Z_INDEX_CLASS}
        layerClassName={LAYER_CLASS}
        cardClassName={CARD_CLASS}
      >
        <div className="app-modal-scroll modal-scroll max-h-[90dvh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
          <div className="app-modal-header flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {t("admin.technicians.newTech.kicker")}
              </p>
              <h2 id={titleId} className="text-lg font-semibold">
                {t("admin.technicians.newTech.title")}
              </h2>
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
          <TechnicianCreateForm
            createTechnicianAction={createTechnicianAction}
            onCreated={closeModal}
          />
        </div>
      </AppModal>
    </>
  );
}
