"use client";

import { useId, useState } from "react";
import InvoiceCreateForm from "@/components/invoices/InvoiceCreateForm";
import AppModal from "@/components/ui/AppModal";

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
  const titleId = useId();

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
        onClick={() => setIsOpen(true)}
      >
        {triggerLabel}
      </button>

      <AppModal
        open={isOpen}
        onClose={closeModal}
        titleId={titleId}
        zIndexClass="z-[1600]"
        layerClassName="overflow-y-auto p-3 sm:p-6"
        backdropClassName="app-modal-backdrop"
        cardClassName="my-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl xl:max-w-5xl"
      >
        <div className="app-modal-scroll modal-scroll max-h-[90dvh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
          <div className="app-modal-header flex items-center justify-between gap-3">
            <div>
              <p className="app-modal-kicker text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {kicker}
              </p>
              <h2 id={titleId} className="app-modal-title text-lg font-semibold">
                {title}
              </h2>
            </div>
            <button
              type="button"
              className="app-modal-close"
              aria-label={closeLabel}
              title={closeLabel}
              onClick={closeModal}
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

          <InvoiceCreateForm
            customers={customers}
            jobs={jobs}
            createInvoiceAction={createInvoiceAction}
            onCreated={closeModal}
          />
        </div>
      </AppModal>
    </>
  );
}
