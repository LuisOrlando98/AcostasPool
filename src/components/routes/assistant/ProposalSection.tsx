"use client";

/**
 * Paso 2: la propuesta editable. Recibe el foco tras generar (el encabezado es
 * `tabIndex={-1}`) y agrupa estrategia, métricas, barra de edición, una ruta
 * por técnico y los excluidos.
 *
 * Aquí vive el arrastre: el contenedor de las zonas (`useStopDrag`) envuelve
 * las tarjetas de técnico y el panel de excluidos, y cada soltar se traduce a
 * la operación del borrador que corresponde (reordenar, reasignar, restaurar o
 * excluir).
 */

import { useCallback, useRef, useState, type RefObject } from "react";
import { useI18n } from "@/i18n/client";
import type {
  AssistantPlan,
  AssistantStop,
  AssistantStrategy,
} from "@/lib/routing/assistant-types";
import { canUndo, isDirty, lastUndoLabel, type Draft } from "@/lib/routing/draft";
import DraftToolbar from "./DraftToolbar";
import ExcludedPanel from "./ExcludedPanel";
import LocationFixModal from "./LocationFixModal";
import ProposalSummary from "./ProposalSummary";
import RouteCard from "./RouteCard";
import StrategyPicker from "./StrategyPicker";
import {
  collectLateTechnicianIds,
  findStopLocation,
  resolveRestoreTarget,
  summarizeRoutes,
} from "./draft-view";
import type { AssistantDraftController } from "./use-assistant-draft";
import { EXCLUDED_ZONE_ID, useStopDrag } from "./use-stop-drag";

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
  readonly onAnnounce: (message: string) => void;
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
  onAnnounce,
}: ProposalSectionProps) {
  const { t } = useI18n();
  const [fixJobId, setFixJobId] = useState<string | null>(null);
  const routeMeta = new Map(
    (controller.plan?.routes ?? []).map((route) => [route.technicianId, route])
  );
  const summary = summarizeRoutes(
    draft.routes,
    collectLateTechnicianIds(controller.plan?.routes ?? [])
  );
  const disabled = busy || stale;

  const isExcluded = useCallback(
    (jobId: string) => draft.removed.some((stop) => stop.jobId === jobId),
    [draft.removed]
  );

  /** Soltar sobre una ruta: restaurar si venía de los excluidos, mover si no. */
  const handleDrop = useCallback(
    (jobId: string, technicianId: string, index: number) => {
      if (isExcluded(jobId)) {
        controller.restore(jobId, technicianId, index);
        return;
      }
      controller.moveToRoute(jobId, technicianId, index);
    },
    [controller, isExcluded]
  );

  const handleExclude = useCallback(
    (jobId: string) => {
      if (!isExcluded(jobId)) {
        controller.remove(jobId);
      }
    },
    [controller, isExcluded]
  );

  const handleDragCancel = useCallback(
    () => onAnnounce(t("admin.routes.assistant.drag.cancelled")),
    [onAnnounce, t]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useStopDrag({
    containerRef,
    disabled,
    onDrop: handleDrop,
    onExclude: handleExclude,
    onCancel: handleDragCancel,
  });
  const draggingJobId = drag.state?.jobId ?? null;
  const activeZone = drag.state?.zoneId ?? null;

  const handleRestore = (jobId: string) => {
    const stop = draft.removed.find((candidate) => candidate.jobId === jobId);
    if (!stop) {
      return;
    }
    controller.restore(jobId, resolveRestoreTarget(draft.routes, stop));
  };

  /**
   * Tras corregir la ubicación se fuerza el recálculo: recarga los trabajos
   * por id, recoge las coordenadas nuevas y la parada pierde el chip.
   */
  const handleLocationFixed = (fixed: AssistantStop) => {
    setFixJobId(null);
    onAnnounce(
      t("admin.routes.assistant.announce.locationFixed", { name: fixed.customerName })
    );
    controller.recalculateNow();
  };

  const handleKeyboardMove = (jobId: string, delta: -1 | 1) => {
    if (delta === -1) {
      controller.moveUp(jobId);
      return;
    }
    controller.moveDown(jobId);
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

      <p className="text-xs text-slate-500">
        {t("admin.routes.assistant.drag.hint")}
      </p>

      <div ref={containerRef} className="space-y-3">
        {draft.routes.map((route) => (
          <RouteCard
            key={route.technicianId}
            route={route}
            meta={routeMeta.get(route.technicianId) ?? null}
            pending={controller.etasPending}
            busy={controller.recalculating}
            disabled={disabled}
            draggingJobId={draggingJobId}
            dropIndex={
              activeZone === route.technicianId ? (drag.state?.index ?? 0) : null
            }
            handleProps={drag.handleProps}
            onKeyboardMove={handleKeyboardMove}
            onMove={onMoveRequest}
            onRemove={controller.remove}
            onFixLocation={setFixJobId}
          />
        ))}

        <ExcludedPanel
          stops={draft.removed}
          disabled={disabled}
          active={activeZone === EXCLUDED_ZONE_ID}
          draggingJobId={draggingJobId}
          handleProps={drag.handleProps}
          onRestore={handleRestore}
        />
      </div>

      <LocationFixModal
        open={fixJobId !== null}
        stop={findStopLocation(draft.routes, fixJobId ?? "")?.stop ?? null}
        onClose={() => setFixJobId(null)}
        onFixed={handleLocationFixed}
      />
    </section>
  );
}
