"use client";

/**
 * Paso 3, fijo al fondo: los contadores del diff y las dos acciones (ver
 * cambios y aplicar). Se mantiene visible aunque no haya cambios, con el botón
 * de aplicar desactivado, para que la acción principal tenga siempre un sitio
 * conocido en lugar de aparecer y desaparecer bajo el dedo.
 */

import { useI18n } from "@/i18n/client";
import type { DraftDiff } from "@/lib/routing/draft";
import { ListIcon } from "./icons";

type ApplyBarProps = {
  readonly diff: DraftDiff;
  readonly applying: boolean;
  readonly blocked: boolean;
  readonly onReview: () => void;
  readonly onApply: () => void;
};

export default function ApplyBar({
  diff,
  applying,
  blocked,
  onReview,
  onApply,
}: ApplyBarProps) {
  const { t } = useI18n();
  const hasChanges = diff.total > 0;

  return (
    <div
      data-testid="route-assistant-apply-bar"
      className="sticky bottom-0 z-20 -mx-1 border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          {hasChanges
            ? t("admin.routes.assistant.changes.summary", {
                total: diff.total,
                reordered: diff.reordered,
                reassigned: diff.reassigned,
                removed: diff.removed,
              })
            : t("admin.routes.assistant.changes.none")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReview}
            disabled={!hasChanges}
            className="app-button-secondary inline-flex min-h-11 items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            <ListIcon />
            <span>{t("admin.routes.assistant.actions.viewChanges")}</span>
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={!hasChanges || applying || blocked}
            className="app-button-primary min-h-11 px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            {applying
              ? t("admin.routes.assistant.actions.applying")
              : t("admin.routes.assistant.actions.applyCount", { count: diff.total })}
          </button>
        </div>
      </div>
    </div>
  );
}
