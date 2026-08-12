"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { useConfirm } from "@/lib/ui/use-confirm";

type Props = {
  invoiceId: string;
  deleteInvoiceAction: (formData: FormData) => Promise<void>;
  className: string;
};

export default function DeleteInvoiceButton({
  invoiceId,
  deleteInvoiceAction,
  className,
}: Props) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const [pending, startTransition] = useTransition();
  const pendingLabel = locale === "es" ? "Eliminando..." : "Deleting...";
  const confirmDeleteMessage =
    locale === "es"
      ? "Se eliminara esta factura de forma permanente. Deseas continuar?"
      : "This invoice will be permanently deleted. Do you want to continue?";

  const handleClick = async () => {
    const confirmed = await confirm(confirmDeleteMessage, {
      tone: "danger",
      confirmLabel: t("common.actions.delete"),
    });
    if (!confirmed) {
      return;
    }
    const formData = new FormData();
    formData.set("invoiceId", invoiceId);
    startTransition(async () => {
      await deleteInvoiceAction(formData);
      router.refresh();
    });
  };

  return (
    <>
      <button type="button" disabled={pending} onClick={handleClick} className={className}>
        {pending ? pendingLabel : t("common.actions.delete")}
      </button>
      {ConfirmDialog}
    </>
  );
}
