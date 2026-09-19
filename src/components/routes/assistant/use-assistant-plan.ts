"use client";

/**
 * Paso 1: petición de propuestas. Cada generación cancela la anterior, de modo
 * que una respuesta lenta nunca pisa a una más reciente.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { AssistantPlanResponse } from "@/lib/routing/assistant-types";
import { requestPlan } from "./api";
import { describeAssistantError } from "./errors";
import type { AssistantFilterValues } from "./types";

export type AssistantPlanController = {
  readonly response: AssistantPlanResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly generate: (filters: AssistantFilterValues) => Promise<AssistantPlanResponse | null>;
  readonly discard: () => void;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useAssistantPlan(): AssistantPlanController {
  const { t } = useI18n();
  const [response, setResponse] = useState<AssistantPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = useCallback(
    async (filters: AssistantFilterValues) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      const fallback = t("admin.routes.assistant.messages.failed");
      try {
        const plan = await requestPlan(
          {
            date: filters.date,
            planTemplate: filters.planTemplate || null,
            technicianIds: filters.technicianIds,
            addressQuery: filters.addressQuery.trim(),
          },
          fallback,
          controller.signal
        );
        setResponse(plan);
        return plan;
      } catch (caught) {
        if (isAbortError(caught)) {
          return null;
        }
        // La propuesta anterior se descarta al fallar: no debe quedar en
        // pantalla algo que ya no corresponde a los filtros pedidos.
        setResponse(null);
        setError(describeAssistantError(caught, t, fallback));
        return null;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [t]
  );

  const discard = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setResponse(null);
    setError(null);
  }, []);

  return { response, loading, error, generate, discard };
}
