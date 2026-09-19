"use client";

/**
 * Paso 3: aplicación del borrador contra `POST /api/routes/bulk-reschedule`.
 * No navega: el resultado (aplicados / omitidos / fallidos) se muestra en la
 * misma pantalla y los fallidos se pueden reintentar.
 */

import { useCallback, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { AssistantUpdate } from "@/lib/routing/assistant-types";
import { requestBulkReschedule } from "./api";
import { describeAssistantError } from "./errors";
import type { BulkRescheduleResult } from "./types";

export type AssistantApplyController = {
  readonly applying: boolean;
  readonly result: BulkRescheduleResult | null;
  readonly error: string | null;
  readonly apply: (updates: readonly AssistantUpdate[]) => Promise<BulkRescheduleResult | null>;
  readonly retryFailed: () => Promise<BulkRescheduleResult | null>;
  readonly clear: () => void;
};

export function useAssistantApply(
  onAnnounce: (message: string) => void
): AssistantApplyController {
  const { t } = useI18n();
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<BulkRescheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Últimas actualizaciones enviadas, para reintentar solo las fallidas. */
  const lastUpdatesRef = useRef<readonly AssistantUpdate[]>([]);

  const send = useCallback(
    async (updates: readonly AssistantUpdate[]) => {
      setApplying(true);
      setError(null);
      const fallback = t("admin.routes.assistant.messages.applyFailed");
      try {
        const response = await requestBulkReschedule(updates, fallback);
        lastUpdatesRef.current = updates;
        setResult(response);
        onAnnounce(
          t("admin.routes.assistant.announce.applied", {
            applied: response.applied.length,
            failed: response.failed.length,
          })
        );
        return response;
      } catch (caught) {
        setError(describeAssistantError(caught, t, fallback));
        return null;
      } finally {
        setApplying(false);
      }
    },
    [onAnnounce, t]
  );

  const retryFailed = useCallback(async () => {
    const failedIds = new Set(result?.failed.map((failure) => failure.id) ?? []);
    const pending = lastUpdatesRef.current.filter((update) =>
      failedIds.has(update.jobId)
    );
    if (pending.length === 0) {
      return null;
    }
    return send(pending);
  }, [result, send]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    lastUpdatesRef.current = [];
  }, []);

  return { applying, result, error, apply: send, retryFailed, clear };
}
