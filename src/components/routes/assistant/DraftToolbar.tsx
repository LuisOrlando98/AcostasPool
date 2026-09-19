"use client";

/**
 * Barra de edición del borrador. "Deshacer" nombra lo que va a deshacer
 * (`lastUndoLabel` devuelve `"<tipo>:<jobId>"`) en lugar de ser un botón mudo.
 */

import { useI18n } from "@/i18n/client";
import { parseUndoKind, undoKindKey } from "./labels";
import { RecalculateIcon, ResetIcon, UndoIcon } from "./icons";

type DraftToolbarProps = {
  readonly pending: boolean;
  readonly recalculating: boolean;
  readonly canUndo: boolean;
  readonly undoLabel: string | null;
  readonly dirty: boolean;
  readonly disabled: boolean;
  readonly onRecalculate: () => void;
  readonly onUndo: () => void;
  readonly onReset: () => void;
};

const BUTTON_CLASS =
  "app-button-secondary inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-semibold";

export default function DraftToolbar({
  pending,
  recalculating,
  canUndo,
  undoLabel,
  dirty,
  disabled,
  onRecalculate,
  onUndo,
  onReset,
}: DraftToolbarProps) {
  const { t } = useI18n();
  const undoKind = parseUndoKind(undoLabel);
  const undoText = undoKind
    ? t("admin.routes.assistant.actions.undoWhat", { label: t(undoKindKey(undoKind)) })
    : t("admin.routes.assistant.actions.undo");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onRecalculate}
        disabled={disabled || recalculating}
        className={BUTTON_CLASS}
      >
        <RecalculateIcon />
        <span>
          {recalculating
            ? t("admin.routes.assistant.actions.recalculating")
            : t("admin.routes.assistant.actions.recalculate")}
        </span>
      </button>
      <button
        type="button"
        onClick={onUndo}
        disabled={disabled || !canUndo}
        className={BUTTON_CLASS}
      >
        <UndoIcon />
        <span>{undoText}</span>
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={disabled || !dirty}
        className={BUTTON_CLASS}
      >
        <ResetIcon />
        <span>{t("admin.routes.assistant.actions.reset")}</span>
      </button>
      {pending ? (
        <span className="app-chip px-3 py-1.5 text-[11px]" data-tone="warning">
          {recalculating
            ? t("admin.routes.assistant.eta.recalculating")
            : t("admin.routes.assistant.eta.pending")}
        </span>
      ) : null}
    </div>
  );
}
