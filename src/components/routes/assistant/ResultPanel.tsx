"use client";

/**
 * Resultado de aplicar, sin abandonar la pantalla: aplicados, omitidos y
 * fallidos con su motivo, reintento solo de los fallidos y enlace al
 * calendario del mes resaltando el primer trabajo aplicado.
 */

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import StatCard from "@/components/ui/StatCard";
import { buildCalendarHref } from "./format";
import type { BulkRescheduleResult } from "./types";

type ResultPanelProps = {
  readonly result: BulkRescheduleResult;
  readonly date: string;
  readonly retrying: boolean;
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
};

export default function ResultPanel({
  result,
  date,
  retrying,
  onRetry,
  onDismiss,
}: ResultPanelProps) {
  const { t } = useI18n();
  const hasFailures = result.failed.length > 0;

  return (
    <section
      aria-labelledby="route-assistant-result-title"
      className="app-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2
          id="route-assistant-result-title"
          className="text-base font-semibold text-slate-900"
        >
          {t("admin.routes.assistant.result.title")}
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="app-button-ghost min-h-11 px-3 py-2 text-xs font-semibold"
        >
          {t("common.actions.close")}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("admin.routes.assistant.result.applied")}
          value={String(result.applied.length)}
          tone="success"
        />
        <StatCard
          label={t("admin.routes.assistant.result.skipped")}
          value={String(result.skipped.length)}
        />
        <StatCard
          label={t("admin.routes.assistant.result.failed")}
          value={String(result.failed.length)}
          tone={hasFailures ? "danger" : "info"}
        />
      </div>

      {hasFailures ? (
        <ul className="mt-4 space-y-1 text-xs text-rose-700">
          {result.failed.map((failure) => (
            <li key={failure.id}>
              {t("admin.routes.assistant.result.failureLine", {
                jobId: failure.id,
                error: failure.error,
              })}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {hasFailures ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="app-button-primary min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            {retrying
              ? t("admin.routes.assistant.actions.applying")
              : t("admin.routes.assistant.actions.retryFailed")}
          </button>
        ) : null}
        <Link
          href={buildCalendarHref(date, result.applied[0])}
          className="app-button-secondary inline-flex min-h-11 items-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
        >
          {t("admin.routes.assistant.result.calendarLink")}
        </Link>
      </div>
    </section>
  );
}
