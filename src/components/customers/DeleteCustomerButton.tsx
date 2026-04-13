"use client";

import { useFormStatus } from "react-dom";
import { useI18n } from "@/i18n/client";

type Props = {
  customerId: string;
  deleteCustomerAction: (formData: FormData) => Promise<void>;
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

export default function DeleteCustomerButton({
  customerId,
  deleteCustomerAction,
  className,
}: Props) {
  const { locale, t } = useI18n();
  const pendingLabel = locale === "es" ? "Eliminando..." : "Deleting...";
  const confirmDeleteMessage =
    locale === "es"
      ? "Se eliminara este cliente y sus datos relacionados de forma permanente. Deseas continuar?"
      : "This customer and related records will be permanently deleted. Do you want to continue?";

  return (
    <form
      action={deleteCustomerAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmDeleteMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="confirmDelete" value="yes" />
      <SubmitDeleteButton
        idleLabel={t("admin.customers.detail.actions.deleteCustomer")}
        pendingLabel={pendingLabel}
        className={className}
      />
    </form>
  );
}
