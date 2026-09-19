/**
 * Tipos propios de la interfaz del asistente de rutas. Los tipos del dominio
 * (plan, parada, ruta) viven en `@/lib/routing/assistant-types` y el borrador
 * editable en `@/lib/routing/draft`: aquí solo está lo que necesita la UI.
 */

import type { AssistantTechnician } from "@/lib/routing/assistant-types";

export type AssistantPlanOption = {
  readonly value: string;
  readonly label: string;
};

/** Valores del formulario del paso 1. `""`/`[]` significan "todos". */
export type AssistantFilterValues = {
  readonly date: string;
  readonly planTemplate: string;
  readonly technicianIds: readonly string[];
  readonly addressQuery: string;
};

/** Cuerpo de `POST /api/admin/routes/assistant/plan`. */
export type AssistantPlanRequest = {
  readonly date: string;
  readonly planTemplate: string | null;
  readonly technicianIds: readonly string[];
  readonly addressQuery: string;
};

export type BulkRescheduleFailure = {
  readonly id: string;
  readonly error: string;
};

/** Respuesta de `POST /api/routes/bulk-reschedule`. */
export type BulkRescheduleResult = {
  readonly ok: boolean;
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
  readonly failed: readonly BulkRescheduleFailure[];
};

export type RouteAssistantSettings = {
  readonly dailyAutoOptimizeEnabled: boolean;
  readonly originAddress: string;
};

export type RouteAssistantProps = {
  readonly initialDate: string;
  readonly initialPlanTemplate: string | null;
  readonly autoOptimizeEnabled: boolean;
  readonly originAddress: string;
  readonly planOptions: readonly AssistantPlanOption[];
  readonly technicians: readonly AssistantTechnician[];
};

/** Función `t` de `useI18n()`, sin arrastrar el contexto entero. */
export type { TranslateFn } from "@/i18n/core";
