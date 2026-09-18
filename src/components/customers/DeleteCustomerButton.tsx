"use client";

import { useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import AppModal from "@/components/ui/AppModal";
import { useI18n } from "@/i18n/client";
import { DELETE_CONFIRMATION_KEYWORDS } from "./forms/delete-confirmation";

type Props = {
  customerId: string;
  deleteCustomerAction: (formData: FormData) => Promise<void>;
  className: string;
};

const MODAL_Z_INDEX_CLASS = "z-[2600]";
const MODAL_LAYER_CLASS = "overflow-y-auto p-3 sm:p-6";
const MODAL_CARD_CLASS =
  "max-w-xl overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl";
const CANCEL_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300";
const SUBMIT_BUTTON_BASE_CLASS =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition";
const SUBMIT_BUTTON_READY_CLASS =
  "border border-rose-200 bg-rose-600 text-white hover:bg-rose-700";
const SUBMIT_BUTTON_LOCKED_CLASS = "border border-slate-200 bg-slate-100 text-slate-400";

function SubmitDeleteButton({
  idleLabel,
  pendingLabel,
  className,
  disabled,
}: {
  idleLabel: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export default function DeleteCustomerButton({
  customerId,
  deleteCustomerAction,
  className,
}: Props) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const keyword = DELETE_CONFIRMATION_KEYWORDS[locale];
  const normalizedConfirmation = confirmationText.trim().toLowerCase();
  const matchesKeyword = normalizedConfirmation === keyword;
  const closeLabel = t("common.actions.close");

  const closeModal = () => {
    setOpen(false);
    setConfirmationText("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={className}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5l.7 10.2A2 2 0 0 0 10.2 19.5h3.6a2 2 0 0 0 2-1.8l.7-10.2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v4.5M14 11v4.5" />
        </svg>
        <span>{t("admin.customers.detail.actions.deleteCustomer")}</span>
      </button>
      <AppModal
        open={open}
        onClose={closeModal}
        titleId={titleId}
        describedBy={descriptionId}
        zIndexClass={MODAL_Z_INDEX_CLASS}
        layerClassName={MODAL_LAYER_CLASS}
        cardClassName={MODAL_CARD_CLASS}
        initialFocusRef={inputRef}
      >
        <div className="app-modal-scroll modal-scroll max-h-[90dvh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
          <div className="app-modal-header flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">
                {t("admin.customers.detail.delete.kicker")}
              </p>
              <h2 id={titleId} className="mt-2 text-lg font-semibold text-slate-900">
                {t("admin.customers.detail.delete.title")}
              </h2>
              <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">
                {t("admin.customers.detail.delete.description", { keyword })}
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
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

          <form action={deleteCustomerAction} className="mt-5 space-y-4">
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="confirmDelete" value="yes" />
            <input type="hidden" name="typedConfirmation" value={normalizedConfirmation} />

            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <label
                htmlFor={inputId}
                className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700"
              >
                {t("admin.customers.detail.delete.inputLabel", { keyword })}
              </label>
              <input
                id={inputId}
                ref={inputRef}
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                autoComplete="off"
                className="app-input mt-2 w-full border-rose-200 px-4 py-3 text-sm"
              />
              <p className="mt-2 text-xs text-rose-700">
                {t("admin.customers.detail.delete.irreversible")}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={closeModal} className={CANCEL_BUTTON_CLASS}>
                {t("common.actions.cancel")}
              </button>
              <SubmitDeleteButton
                idleLabel={t("admin.customers.detail.actions.deleteCustomer")}
                pendingLabel={t("admin.customers.detail.delete.pending")}
                className={`${SUBMIT_BUTTON_BASE_CLASS} ${
                  matchesKeyword ? SUBMIT_BUTTON_READY_CLASS : SUBMIT_BUTTON_LOCKED_CLASS
                }`}
                disabled={!matchesKeyword}
              />
            </div>
          </form>
        </div>
      </AppModal>
    </>
  );
}
