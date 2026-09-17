"use client";

import { useId, useRef, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import AppModal from "@/components/ui/AppModal";

export type ConfirmDialogTone = "danger" | "default";

export type ConfirmDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  /** Etiqueta explícita de la acción (p. ej. "Eliminar"); `t("common.actions.confirm")` como genérica. */
  readonly confirmLabel: string;
  /** Por defecto `t("common.actions.cancel")`. */
  readonly cancelLabel?: string;
  readonly tone?: ConfirmDialogTone;
  /** Mientras sea true se desactivan los botones y el cierre por backdrop/Escape. */
  readonly busy?: boolean;
  /** Mensaje de error anunciado con role="alert". */
  readonly error?: string | null;
  /** Sustituye el z-index por defecto (`z-[2600]`, por encima del resto de modales). */
  readonly zIndexClass?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** Contenido extra entre la descripción y los botones (resúmenes, avisos...). */
  readonly children?: ReactNode;
};

const CONFIRM_DIALOG_Z_INDEX_CLASS = "z-[2600]";
const LAYER_CLASS = "overflow-y-auto p-3 sm:p-6";
const CARD_CLASS = "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl";
const BUTTON_BASE_CLASS =
  "inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60";
const CONFIRM_TONE_CLASS: Record<ConfirmDialogTone, string> = {
  default: "app-button-primary",
  danger:
    "rounded-full border border-rose-200 bg-rose-600 text-white transition hover:bg-rose-700",
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  busy = false,
  error,
  zIndexClass = CONFIRM_DIALOG_Z_INDEX_CLASS,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resolvedCancelLabel = cancelLabel ?? t("common.actions.cancel");

  return (
    <AppModal
      open={open}
      onClose={onCancel}
      titleId={titleId}
      describedBy={description ? descriptionId : undefined}
      size="sm"
      zIndexClass={zIndexClass}
      layerClassName={LAYER_CLASS}
      cardClassName={CARD_CLASS}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      initialFocusRef={cancelRef}
    >
      <div className="p-5 sm:p-6" aria-busy={busy || undefined}>
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-2 text-sm text-slate-500">
            {description}
          </p>
        ) : null}
        {children}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`app-button-secondary ${BUTTON_BASE_CLASS}`}
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`${CONFIRM_TONE_CLASS[tone]} ${BUTTON_BASE_CLASS}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
