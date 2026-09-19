"use client";

/**
 * Asistente de rutas en tres pasos: filtros → propuesta editable → revisar y
 * aplicar. Este archivo solo orquesta (estado de pantalla y modales); el
 * trabajo vive en los hooks (`use-assistant-*`) y en los componentes de paso.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import RoutesSectionTabs from "@/components/routes/RoutesSectionTabs";
import type { AssistantStrategy } from "@/lib/routing/assistant-types";
import { diffDraft, toUpdates } from "@/lib/routing/draft";
import ApplyBar from "./ApplyBar";
import ApplyConfirmDialog from "./ApplyConfirmDialog";
import AssistantFilters from "./AssistantFilters";
import AutomationModal from "./AutomationModal";
import ChangesModal from "./ChangesModal";
import EmptyProposal from "./EmptyProposal";
import FiltersSummary from "./FiltersSummary";
import MoveStopModal from "./MoveStopModal";
import ProposalSection from "./ProposalSection";
import ResultPanel from "./ResultPanel";
import { collectStops, findStopLocation } from "./draft-view";
import { countActiveStops } from "./format";
import type { RouteAssistantProps, AssistantFilterValues, RouteAssistantSettings } from "./types";
import { useAssistantApply } from "./use-assistant-apply";
import { useAssistantDraft } from "./use-assistant-draft";
import { useAssistantPlan } from "./use-assistant-plan";

const EMPTY_DIFF = {
  changes: [],
  reordered: 0,
  reassigned: 0,
  removed: 0,
  total: 0,
} as const;

export default function RouteAssistant({
  initialDate,
  initialPlanTemplate,
  autoOptimizeEnabled,
  originAddress,
  planOptions,
  technicians,
}: RouteAssistantProps) {
  const { t } = useI18n();
  const [filters, setFilters] = useState<AssistantFilterValues>({
    date: initialDate,
    planTemplate: initialPlanTemplate ?? "",
    technicianIds: [],
    addressQuery: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [stale, setStale] = useState(false);
  const [strategy, setStrategy] = useState<AssistantStrategy | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [focusToken, setFocusToken] = useState(0);
  const [changesOpen, setChangesOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [moveJobId, setMoveJobId] = useState<string | null>(null);
  const [settings, setSettings] = useState<RouteAssistantSettings>({
    dailyAutoOptimizeEnabled: autoOptimizeEnabled,
    originAddress,
  });
  const headingRef = useRef<HTMLHeadingElement>(null);

  const plan = useAssistantPlan();
  const draft = useAssistantDraft({ date: filters.date, onAnnounce: setAnnouncement });
  const apply = useAssistantApply(setAnnouncement);

  const { start: startDraft, clear: clearDraft } = draft;
  const { generate } = plan;
  const { clear: clearResult } = apply;

  useEffect(() => {
    if (focusToken > 0) {
      headingRef.current?.focus();
    }
  }, [focusToken]);

  const handleFiltersChange = useCallback(
    (values: AssistantFilterValues) => {
      setFilters(values);
      setStale(true);
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    clearResult();
    const response = await generate(filters);
    if (!response) {
      clearDraft();
      setStrategy(null);
      return;
    }
    const first = response.plans[0] ?? null;
    setStrategy(first?.strategy ?? null);
    if (first) {
      startDraft(first, response.technicians);
    } else {
      clearDraft();
    }
    setStale(false);
    setFiltersOpen(false);
    setFocusToken((token) => token + 1);
    setAnnouncement(
      t("admin.routes.assistant.announce.generated", {
        stops: first?.summary.totalStops ?? 0,
        excluded: response.excludedCount,
      })
    );
  }, [clearDraft, clearResult, filters, generate, startDraft, t]);

  const handleSelectStrategy = useCallback(
    (next: AssistantStrategy) => {
      const selected = plan.response?.plans.find((item) => item.strategy === next);
      if (!selected || !plan.response) {
        return;
      }
      setStrategy(next);
      startDraft(selected, plan.response.technicians);
      setAnnouncement(t(`admin.routes.assistant.strategies.${next}.name`));
    },
    [plan.response, startDraft, t]
  );

  const current = draft.draft;
  const diff = current ? diffDraft(current) : EMPTY_DIFF;
  const stops = current ? [...collectStops(current.routes), ...current.removed] : [];
  // Memoizado porque es dependencia del `useCallback` que aplica el borrador.
  const updates = useMemo(() => (current ? toUpdates(current) : []), [current]);
  const moveLocation =
    current && moveJobId ? findStopLocation(current.routes, moveJobId) : null;
  const isEmptyProposal = Boolean(plan.response) && stops.length === 0;

  const handleMoveConfirm = useCallback(
    (technicianId: string | null) => {
      if (!moveJobId) {
        return;
      }
      if (technicianId) {
        draft.moveToRoute(moveJobId, technicianId);
      } else {
        draft.remove(moveJobId);
      }
      setMoveJobId(null);
    },
    [draft, moveJobId]
  );

  const handleApply = useCallback(async () => {
    const result = await apply.apply(updates);
    if (result) {
      setConfirmOpen(false);
    }
  }, [apply, updates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RoutesSectionTabs />
        <button
          type="button"
          onClick={() => setAutomationOpen(true)}
          className="app-button-ghost min-h-11 px-3 py-2 text-xs font-semibold text-slate-600"
        >
          {t("admin.routes.assistant.automation.link")}
        </button>
      </div>

      <p
        role="status"
        aria-live="polite"
        data-testid="route-assistant-announcements"
        className="min-h-5 text-xs text-slate-600"
      >
        {announcement}
      </p>

      {filtersOpen ? (
        <AssistantFilters
          values={filters}
          planOptions={planOptions}
          technicians={technicians}
          originAddress={plan.response?.originAddress ?? settings.originAddress}
          loading={plan.loading}
          onChange={handleFiltersChange}
          onSubmit={() => void handleGenerate()}
        />
      ) : (
        <FiltersSummary
          values={filters}
          planOptions={planOptions}
          technicians={technicians}
          onEdit={() => setFiltersOpen(true)}
        />
      )}

      {plan.error ? (
        <p
          role="alert"
          className="app-callout px-4 py-3 text-sm"
          data-tone="danger"
        >
          {plan.error}
        </p>
      ) : null}

      {isEmptyProposal ? (
        <EmptyProposal
          excludedCount={plan.response?.excludedCount ?? 0}
          values={filters}
          planOptions={planOptions}
          technicians={technicians}
          onEditFilters={() => setFiltersOpen(true)}
        />
      ) : null}

      {current && plan.response && !isEmptyProposal ? (
        <>
          <ProposalSection
            headingRef={headingRef}
            plans={plan.response.plans}
            selectedStrategy={strategy}
            onSelectStrategy={handleSelectStrategy}
            draft={current}
            controller={draft}
            stale={stale}
            busy={apply.applying}
            onMoveRequest={setMoveJobId}
          />
          <ApplyBar
            diff={diff}
            applying={apply.applying}
            blocked={stale || draft.recalculating}
            onReview={() => setChangesOpen(true)}
            onApply={() => setConfirmOpen(true)}
          />
        </>
      ) : null}

      {apply.error ? (
        <p role="alert" className="app-callout px-4 py-3 text-sm" data-tone="danger">
          {apply.error}
        </p>
      ) : null}

      {apply.result ? (
        <ResultPanel
          result={apply.result}
          date={filters.date}
          retrying={apply.applying}
          onRetry={() => void apply.retryFailed()}
          onDismiss={clearResult}
        />
      ) : null}

      <ChangesModal
        open={changesOpen}
        diff={diff}
        stops={stops}
        technicians={plan.response?.technicians ?? technicians}
        onClose={() => setChangesOpen(false)}
      />

      <MoveStopModal
        open={moveJobId !== null}
        stop={moveLocation?.stop ?? null}
        currentTechnicianId={moveLocation?.route.technicianId ?? null}
        routes={current?.routes ?? []}
        onClose={() => setMoveJobId(null)}
        onConfirm={handleMoveConfirm}
      />

      <ApplyConfirmDialog
        open={confirmOpen}
        diff={diff}
        activeStopCount={countActiveStops(
          stops,
          updates.map((update) => update.jobId)
        )}
        applying={apply.applying}
        error={apply.error}
        onConfirm={() => void handleApply()}
        onCancel={() => setConfirmOpen(false)}
      />

      <AutomationModal
        open={automationOpen}
        settings={settings}
        onClose={() => setAutomationOpen(false)}
        onSaved={(saved) => {
          setSettings(saved);
          setAutomationOpen(false);
          setAnnouncement(t("admin.routes.assistant.messages.preferencesSaved"));
        }}
      />
    </div>
  );
}
