"use client";

/**
 * Métricas de la propuesta en curso, calculadas sobre el borrador (no sobre el
 * resumen del servidor) para que sigan siendo ciertas después de editar. Los
 * avisos (paradas sin ubicación y rutas que terminan tarde) usan su tono.
 */

import { useI18n } from "@/i18n/client";
import StatCard from "@/components/ui/StatCard";
import { formatMinutes } from "./format";
import type { DraftSummary } from "./draft-view";

type ProposalSummaryProps = {
  readonly summary: DraftSummary;
  readonly excludedCount: number;
  readonly pending: boolean;
};

export default function ProposalSummary({
  summary,
  excludedCount,
  pending,
}: ProposalSummaryProps) {
  const { t } = useI18n();
  const pendingHelper = pending
    ? t("admin.routes.assistant.eta.pending")
    : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard
        label={t("admin.routes.assistant.metrics.stops")}
        value={String(summary.stops)}
        helper={t.plural("admin.routes.assistant.metrics.excluded", excludedCount)}
      />
      <StatCard
        label={t("admin.routes.assistant.metrics.drive")}
        value={formatMinutes(summary.driveMinutes)}
        helper={pendingHelper}
        tone={pending ? "warning" : "info"}
      />
      <StatCard
        label={t("admin.routes.assistant.metrics.service")}
        value={formatMinutes(summary.serviceMinutes)}
        helper={pendingHelper}
      />
      <StatCard
        label={t("admin.routes.assistant.metrics.warnings")}
        value={String(summary.warnings)}
        helper={t("admin.routes.assistant.metrics.warningsHelper", {
          missing: summary.withoutCoordinates,
          late: summary.lateRoutes,
        })}
        tone={summary.warnings > 0 ? "warning" : "success"}
      />
    </div>
  );
}
