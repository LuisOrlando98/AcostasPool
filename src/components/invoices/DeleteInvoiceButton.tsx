"use client";

import { useFormStatus } from "react-dom";
import { useI18n } from "@/i18n/client";

type Props = {
  invoiceId: string;
  deleteInvoiceAction: (formData: FormData) => Promise<void>;
  className: string;
};

function SubmitDeleteButton({
  idleLabel,
  pendingLabel,
  className,
}: {
  idleLabel: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export default function DeleteInvoiceButton({
  invoiceId,
  deleteInvoiceAction,
  className,
}: Props) {
  const { locale, t } = useI18n();
  const pendingLabel = locale === "es" ? "Eliminando..." : "Deleting...";
  const confirmDeleteMessage =
    locale === "es"
      ? "Se eliminara esta factura de forma permanente. Deseas continuar?"
      : "This invoice will be permanently deleted. Do you want to continue?";

  return (
    <form
      action={deleteInvoiceAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmDeleteMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <SubmitDeleteButton
        idleLabel={t("common.actions.delete")}
        pendingLabel={pendingLabel}
        className={className}
      />
    </form>
  );
}
