"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { useI18n } from "@/i18n/client";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

type Props = {
  customerId: string;
  deleteCustomerAction: (formData: FormData) => Promise<void>;
  className: string;
};

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
  const keyword = locale === "es" ? "eliminar" : "delete";
  const pendingLabel = locale === "es" ? "Eliminando..." : "Deleting...";
  const modalKicker = locale === "es" ? "Accion permanente" : "Permanent action";
  const modalTitle =
    locale === "es" ? "Eliminar este cliente?" : "Delete this customer?";
  const modalDescription =
    locale === "es"
      ? "Escribe la palabra eliminar para confirmar que eliminaras este cliente, su portal de usuario, propiedades, trabajos, facturas, planes, documentos y cualquier registro historico relacionado."
      : "Type the word delete to confirm that you will delete this customer, their portal user, properties, jobs, invoices, plans, documents, and any related historical records.";
  const inputLabel =
    locale === "es"
      ? 'Escribe "eliminar" para continuar'
      : 'Type "delete" to continue';
  const cancelLabel = locale === "es" ? "Cancelar" : "Cancel";
  const helperLabel =
    locale === "es"
      ? "Esta accion no se puede deshacer."
      : "This action cannot be undone.";
  const matchesKeyword = useMemo(
    () => confirmationText.trim().toLowerCase() === keyword,
    [confirmationText, keyword]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirmationText("");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const closeModal = () => {
    setOpen(false);
    setConfirmationText("");
  };

  const modal =
    typeof document !== "undefined" && open
      ? createPortal(
          <div className="app-modal-layer fixed inset-0 z-[2600] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            <button
              type="button"
              className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
              aria-label={t("common.actions.close")}
              onClick={closeModal}
            />
            <div className="app-modal-card relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl">
              <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">
                      {modalKicker}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-slate-900">
                      {modalTitle}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {modalDescription}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300"
                    aria-label={t("common.actions.close")}
                    title={t("common.actions.close")}
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

                <form action={deleteCustomerAction} className="mt-5 space-y-4">
                  <input type="hidden" name="customerId" value={customerId} />
                  <input type="hidden" name="confirmDelete" value="yes" />
                  <input
                    type="hidden"
                    name="typedConfirmation"
                    value={confirmationText.trim().toLowerCase()}
                  />

                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
                      {inputLabel}
                    </label>
                    <input
                      value={confirmationText}
                      onChange={(event) => setConfirmationText(event.target.value)}
                      className="app-input mt-2 w-full border-rose-200 px-4 py-3 text-sm"
                      autoFocus
                    />
                    <p className="mt-2 text-xs text-rose-700">{helperLabel}</p>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                    >
                      {cancelLabel}
                    </button>
                    <SubmitDeleteButton
                      idleLabel={t("admin.customers.detail.actions.deleteCustomer")}
                      pendingLabel={pendingLabel}
                      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                        matchesKeyword
                          ? "border border-rose-200 bg-rose-600 text-white hover:bg-rose-700"
                          : "border border-slate-200 bg-slate-100 text-slate-400"
                      }`}
                      disabled={!matchesKeyword}
                    />
                  </div>
                </form>
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
      {modal}
    </>
  );
}
