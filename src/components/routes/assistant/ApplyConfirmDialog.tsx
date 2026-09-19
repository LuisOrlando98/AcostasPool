"use client";

/**
 * Confirmación antes de escribir en la agenda: contadores del diff, aviso de
 * los trabajos que ya están en camino o en progreso y aviso de que se enviarán
 * notificaciones.
 */

import { useI18n } from "@/i18n/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { DraftDiff } from "@/lib/routing/draft";

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
      title={t("admin.routes.assistant.apply.confirmTitle", { count: diff.total })}
      description={t("admin.routes.assistant.apply.confirmDescription")}
      confirmLabel={t("admin.routes.assistant.actions.applyCount", {
        count: diff.total,
      })}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <ul className="mt-4 space-y-1 text-sm text-slate-600">
        <li>
          {t("admin.routes.assistant.changes.summary", {
            total: diff.total,
            reordered: diff.reordered,
            reassigned: diff.reassigned,
            removed: diff.removed,
          })}
        </li>
        {activeStopCount > 0 ? (
          <li className="font-medium text-amber-700">
            {t("admin.routes.assistant.apply.warningActive", {
              count: activeStopCount,
            })}
          </li>
        ) : null}
        <li>{t("admin.routes.assistant.apply.warningNotifications")}</li>
      </ul>
    </ConfirmDialog>
  );
}
