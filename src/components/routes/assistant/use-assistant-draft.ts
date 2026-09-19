"use client";

/**
 * Paso 2: borrador editable. Cada edición devuelve un borrador nuevo (el
 * módulo `@/lib/routing/draft` es inmutable), marca las ETAs como pendientes y
 * programa un recálculo con rebote de 600 ms contra el endpoint de recálculo,
 * que solo pide los tramos consecutivos del orden fijado.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import type {
  AssistantPlan,
  AssistantTechnician,
} from "@/lib/routing/assistant-types";
import {
  applyRecalculatedPlan,
  createDraft,
  moveStop,
  moveStopToRoute,
  removeStop,
  resetDraft,
  restoreStop,
  toRecalculateRequest,
  undo,
  type Draft,
} from "@/lib/routing/draft";
import { requestRecalculation } from "./api";
import { findStopLocation } from "./draft-view";
import { describeAssistantError } from "./errors";

/** Ventana de rebote del recálculo automático tras editar (ms). */
export const RECALCULATE_DEBOUNCE_MS = 600;

export type AssistantDraftController = {
  readonly draft: Draft | null;
  /**
   * Último plan devuelto por el servidor (el inicial o el del recálculo): de
   * ahí salen los datos de ruta que el borrador no guarda, como el regreso
   * estimado o `overflowsDay`.
   */
  readonly plan: AssistantPlan | null;
  /** Las ETAs mostradas ya no corresponden al orden actual. */
  readonly etasPending: boolean;
  readonly recalculating: boolean;
  readonly recalculateError: string | null;
  readonly start: (plan: AssistantPlan, technicians: readonly AssistantTechnician[]) => void;
  readonly clear: () => void;
  readonly moveUp: (jobId: string) => void;
  readonly moveDown: (jobId: string) => void;
  readonly moveToRoute: (jobId: string, technicianId: string) => void;
  readonly remove: (jobId: string) => void;
  readonly restore: (jobId: string, technicianId: string) => void;
  readonly undoLast: () => void;
  readonly reset: () => void;
  readonly recalculateNow: () => void;
};

type DraftHookOptions = {
  readonly date: string;
  /** Debe ser estable (p. ej. el `setState` del mensaje `aria-live`). */
  readonly onAnnounce: (message: string) => void;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useAssistantDraft({
  date,
  onAnnounce,
}: DraftHookOptions): AssistantDraftController {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [etasPending, setEtasPending] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateError, setRecalculateError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const draftRef = useRef<Draft | null>(null);
  const immediateRef = useRef(false);
  /** Última petición de recálculo enviada, para no repetirla sin cambios. */
  const lastRequestRef = useRef<string | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  /**
   * Aplica una operación del borrador y programa el recálculo. Trabaja sobre
   * el ref (no sobre un updater de `setState`) porque además de guardar el
   * borrador nuevo hay que anunciar el cambio: los updaters deben ser puros.
   */
  const edit = useCallback(
    (operation: (current: Draft) => Draft, announcement: (next: Draft) => string) => {
      const current = draftRef.current;
      if (!current) {
        return;
      }
      const next = operation(current);
      if (next === current) {
        return;
      }
      draftRef.current = next;
      setDraft(next);
      setEtasPending(true);
      setRecalculateError(null);
      setRevision((value) => value + 1);
      onAnnounce(announcement(next));
    },
    [onAnnounce]
  );

  const describeStop = useCallback(
    (next: Draft, jobId: string, fallbackKey: string) => {
      const location = findStopLocation(next.routes, jobId);
      if (!location) {
        const removed = next.removed.find((stop) => stop.jobId === jobId);
        return t("admin.routes.assistant.announce.removed", {
          name: removed?.customerName ?? "",
        });
      }
      return t(fallbackKey, {
        name: location.stop.customerName,
        position: location.position,
        technician: location.route.technicianName,
      });
    },
    [t]
  );

  const runRecalculation = useCallback(
    async (signal: AbortSignal) => {
      const current = draftRef.current;
      if (!current) {
        return;
      }
      const request = toRecalculateRequest(current, date);
      const requestKey = JSON.stringify(request);
      // El endpoint de recálculo tiene su propio límite de 20 peticiones cada
      // 5 minutos: no se gasta ninguna si el orden es el que ya se pidió (o si
      // no queda ninguna parada en las rutas).
      if (request.routes.length === 0 || requestKey === lastRequestRef.current) {
        setEtasPending(false);
        return;
      }
      setRecalculating(true);
      try {
        const result = await requestRecalculation(
          request,
          t("admin.routes.assistant.messages.recalculateFailed"),
          signal
        );
        setDraft((value) => (value ? applyRecalculatedPlan(value, result.plan) : value));
        setPlan(result.plan);
        lastRequestRef.current = requestKey;
        setEtasPending(false);
        setRecalculateError(null);
        onAnnounce(t("admin.routes.assistant.announce.recalculated"));
      } catch (caught) {
        if (isAbortError(caught)) {
          return;
        }
        setRecalculateError(
          describeAssistantError(
            caught,
            t,
            t("admin.routes.assistant.messages.recalculateFailed")
          )
        );
      } finally {
        setRecalculating(false);
      }
    },
    [date, onAnnounce, t]
  );

  useEffect(() => {
    if (revision === 0) {
      return;
    }
    const controller = new AbortController();
    const delay = immediateRef.current ? 0 : RECALCULATE_DEBOUNCE_MS;
    immediateRef.current = false;
    const timer = setTimeout(() => {
      void runRecalculation(controller.signal);
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [revision, runRecalculation]);

  const start = useCallback(
    (next: AssistantPlan, technicians: readonly AssistantTechnician[]) => {
      const created = createDraft(next, technicians);
      draftRef.current = created;
      setDraft(created);
      setPlan(next);
      lastRequestRef.current = null;
      setEtasPending(false);
      setRecalculateError(null);
      setRevision(0);
    },
    []
  );

  const clear = useCallback(() => {
    draftRef.current = null;
    setDraft(null);
    setPlan(null);
    lastRequestRef.current = null;
    setEtasPending(false);
    setRecalculateError(null);
    setRevision(0);
  }, []);

  const moveUp = useCallback(
    (jobId: string) =>
      edit(
        (current) => moveStop(current, jobId, -1),
        (next) => describeStop(next, jobId, "admin.routes.assistant.announce.moved")
      ),
    [describeStop, edit]
  );

  const moveDown = useCallback(
    (jobId: string) =>
      edit(
        (current) => moveStop(current, jobId, 1),
        (next) => describeStop(next, jobId, "admin.routes.assistant.announce.moved")
      ),
    [describeStop, edit]
  );

  const moveToRoute = useCallback(
    (jobId: string, technicianId: string) =>
      edit(
        (current) => moveStopToRoute(current, jobId, technicianId),
        (next) => describeStop(next, jobId, "admin.routes.assistant.announce.reassigned")
      ),
    [describeStop, edit]
  );

  const remove = useCallback(
    (jobId: string) =>
      edit(
        (current) => removeStop(current, jobId),
        (next) => describeStop(next, jobId, "admin.routes.assistant.announce.removed")
      ),
    [describeStop, edit]
  );

  const restore = useCallback(
    (jobId: string, technicianId: string) =>
      edit(
        (current) => restoreStop(current, jobId, technicianId),
        (next) => describeStop(next, jobId, "admin.routes.assistant.announce.restored")
      ),
    [describeStop, edit]
  );

  const undoLast = useCallback(
    () => edit(undo, () => t("admin.routes.assistant.announce.undone")),
    [edit, t]
  );

  const reset = useCallback(
    () => edit(resetDraft, () => t("admin.routes.assistant.announce.reset")),
    [edit, t]
  );

  const recalculateNow = useCallback(() => {
    immediateRef.current = true;
    setEtasPending(true);
    setRevision((value) => value + 1);
  }, []);

  return {
    draft,
    plan,
    etasPending,
    recalculating,
    recalculateError,
    start,
    clear,
    moveUp,
    moveDown,
    moveToRoute,
    remove,
    restore,
    undoLast,
    reset,
    recalculateNow,
  };
}
