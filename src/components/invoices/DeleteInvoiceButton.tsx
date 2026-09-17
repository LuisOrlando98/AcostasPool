"use client";

import { useState, useTransition } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useI18n } from "@/i18n/client";

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
  const { t } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const openConfirm = () => {
    setDeleteError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (isDeleting) {
      return;
    }
    setConfirmOpen(false);
  };

  const confirmDelete = () => {
    const formData = new FormData();
    formData.set("invoiceId", invoiceId);
    setDeleteError(null);
    startDelete(async () => {
      try {
        await deleteInvoiceAction(formData);
        setConfirmOpen(false);
      } catch {
        setDeleteError(t("admin.invoices.delete.error"));
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openConfirm}
        disabled={isDeleting}
        className={className}
      >
        {isDeleting ? t("common.feedback.deleting") : t("common.actions.delete")}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title={t("admin.invoices.delete.confirmTitle")}
        description={t("admin.invoices.delete.confirmMessage")}
        confirmLabel={t("common.actions.delete")}
        tone="danger"
        busy={isDeleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={closeConfirm}
      />
    </>
  );
}
