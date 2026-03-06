"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import InvoiceCreateForm from "@/components/invoices/InvoiceCreateForm";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

type CustomerOption = {
  id: string;
  name: string;
};

type JobOption = {
  id: string;
  customerId: string;
  scheduledDate: string;
  status: string;
  serviceType: string;
  suggestedUnitPrice?: number | null;
};

type Props = {
  customers: CustomerOption[];
  jobs: JobOption[];
  createInvoiceAction: (formData: FormData) => Promise<void>;
  triggerLabel: string;
  kicker: string;
  title: string;
  closeLabel: string;
};

export default function NewInvoiceModal({
  customers,
  jobs,
  createInvoiceAction,
  triggerLabel,
  kicker,
  title,
  closeLabel,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const unlock = lockBodyScroll();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      unlock();
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
        onClick={() => setIsOpen(true)}
      >
        {triggerLabel}
      </button>

      {isOpen && portalReady
        ? createPortal(
            <div
              className="app-modal-layer fixed inset-0 z-[1600] flex items-center justify-center overflow-y-auto p-3 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <button
                type="button"
                aria-label={closeLabel}
                className="app-modal-backdrop absolute inset-0"
                onClick={() => setIsOpen(false)}
              />
              <div className="app-modal-card relative z-10 my-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl xl:max-w-5xl">
                <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                  <div className="app-modal-header flex items-center justify-between gap-3">
                    <div>
                      <p className="app-modal-kicker text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        {kicker}
                      </p>
                      <h2 className="app-modal-title text-lg font-semibold">{title}</h2>
                    </div>
                    <button
                      type="button"
                      className="app-modal-close"
                      aria-label={closeLabel}
                      title={closeLabel}
                      onClick={() => setIsOpen(false)}
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

                  <InvoiceCreateForm
                    customers={customers}
                    jobs={jobs}
                    createInvoiceAction={createInvoiceAction}
                    onCreated={() => setIsOpen(false)}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
