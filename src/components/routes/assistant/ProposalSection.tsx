"use client";

/**
 * Paso 2: la propuesta editable. Recibe el foco tras generar (el encabezado es
 * `tabIndex={-1}`) y agrupa estrategia, métricas, barra de edición, una ruta
 * por técnico y los excluidos.
 */

import type { RefObject } from "react";
import { useI18n } from "@/i18n/client";
import type { AssistantPlan, AssistantStrategy } from "@/lib/routing/assistant-types";
import { canUndo, isDirty, lastUndoLabel, type Draft } from "@/lib/routing/draft";
import DraftToolbar from "./DraftToolbar";
import ExcludedPanel from "./ExcludedPanel";
import ProposalSummary from "./ProposalSummary";
import RouteCard from "./RouteCard";
import StrategyPicker from "./StrategyPicker";
import { resolveRestoreTarget, summarizeRoutes } from "./draft-view";
import type { AssistantDraftController } from "./use-assistant-draft";

type ProposalSectionProps = {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly plans: readonly AssistantPlan[];
  readonly selectedStrategy: AssistantStrategy | null;
  readonly onSelectStrategy: (strategy: AssistantStrategy) => void;
  readonly draft: Draft;
  readonly controller: AssistantDraftController;
  readonly stale: boolean;
  readonly busy: boolean;
  readonly onMoveRequest: (jobId: string) => void;
};

export default function ProposalSection({
  headingRef,
  plans,
  selectedStrategy,
  onSelectStrategy,
  draft,
  controller,
  stale,
  busy,
  onMoveRequest,
}: ProposalSectionProps) {
  const { t } = useI18n();
  const summary = summarizeRoutes(draft.routes);
  const disabled = busy || stale;

  const routeMeta = new Map(
    (controller.plan?.routes ?? []).map((route) => [route.technicianId, route])
  );

  const handleRestore = (jobId: string) => {
    const stop = draft.removed.find((candidate) => candidate.jobId === jobId);
    if (!stop) {
      return;
    }
    controller.restore(jobId, resolveRestoreTarget(draft.routes, stop));
  };

  return (
    <section
      aria-labelledby="route-assistant-proposal-title"
      className="app-card space-y-4 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="route-assistant-proposal-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-slate-900 outline-none"
        >
          {t("admin.routes.assistant.steps.proposal")}
        </h2>
        <DraftToolbar
          pending={controller.etasPending}
          recalculating={controller.recalculating}
          canUndo={canUndo(draft)}
          undoLabel={lastUndoLabel(draft)}
          dirty={isDirty(draft)}
          disabled={disabled}
          onRecalculate={controller.recalculateNow}
          onUndo={controller.undoLast}
          onReset={controller.reset}
        />
      </div>

      {stale ? (
        <p className="app-callout px-4 py-3 text-sm" data-tone="warning" role="status">
          {t("admin.routes.assistant.stale.message")}
        </p>
      ) : null}

      {controller.recalculateError ? (
        <p
          role="alert"
          className="app-callout px-4 py-3 text-sm"
          data-tone="danger"
        >
          {controller.recalculateError}
        </p>
      ) : null}

      <StrategyPicker
        plans={plans}
        selected={selectedStrategy}
        onSelect={onSelectStrategy}
      />

      <ProposalSummary
        summary={summary}
        excludedCount={draft.removed.length}
        pending={controller.etasPending}
      />

      <div className="space-y-3">
        {draft.routes.map((route) => (
          <RouteCard
            key={route.technicianId}
            route={route}
            meta={routeMeta.get(route.technicianId) ?? null}
            pending={controller.etasPending}
            busy={controller.recalculating}
            disabled={disabled}
            onMoveUp={controller.moveUp}
            onMoveDown={controller.moveDown}
            onMove={onMoveRequest}
            onRemove={controller.remove}
          />
        ))}
      </div>

      <ExcludedPanel
        stops={draft.removed}
        disabled={disabled}
        onRestore={handleRestore}
      />
    </section>
  );
}
