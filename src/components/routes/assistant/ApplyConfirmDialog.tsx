"use client";

/**
 * Confirmación antes de escribir en la agenda: contadores del diff, aviso de
 * los trabajos que ya están en camino o en progreso y aviso de que se enviarán
 * notificaciones.
 */

import { useI18n } from "@/i18n/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { DraftDiff } from "@/lib/routing/draft";
import { formatChangesSummary } from "./format";

type ApplyConfirmDialogProps = {
  readonly open: boolean;
  readonly diff: DraftDiff;
  readonly activeStopCount: number;
  readonly applying: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export default function ApplyConfirmDialog({
  open,
  diff,
  activeStopCount,
  applying,
  error,
  onConfirm,
  onCancel,
}: ApplyConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <ConfirmDialog
      open={open}
      busy={applying}
      error={error}
      title={t.plural("admin.routes.assistant.apply.confirmTitle", diff.total)}
      description={t("admin.routes.assistant.apply.confirmDescription")}
      confirmLabel={t("admin.routes.assistant.actions.applyCount", {
        count: diff.total,
      })}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <ul className="mt-4 space-y-1 text-sm text-slate-600">
        <li>{formatChangesSummary(t, diff)}</li>
        {activeStopCount > 0 ? (
          <li className="font-medium text-amber-700">
            {t.plural("admin.routes.assistant.apply.warningActive", activeStopCount)}
          </li>
        ) : null}
        <li>{t("admin.routes.assistant.apply.warningNotifications")}</li>
      </ul>
    </ConfirmDialog>
  );
}
