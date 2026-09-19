/**
 * Tipos compartidos del asistente de rutas (respuesta de
 * `POST /api/admin/routes/assistant/plan` y `.../recalculate`, borrador
 * editable de la interfaz). Sin dependencias de React ni de Prisma.
 */

export type AssistantDriveSource = "LIVE_TRAFFIC" | "ESTIMATED" | "SAME_ADDRESS";

export type AssistantStrategy = "BALANCED" | "SHORT_DRIVE" | "KEEP_ASSIGNMENTS" | "MANUAL";

export type AssistantJobStatus = "SCHEDULED" | "PENDING" | "ON_THE_WAY" | "IN_PROGRESS";

export type AssistantTechnician = {
  readonly id: string;
  readonly name: string;
};

export type AssistantStop = {
  readonly jobId: string;
  readonly customerName: string;
  readonly address: string;
  readonly propertyName: string | null;
  readonly planName: string | null;
  readonly routeGroupId: string | null;
  readonly routeGroupLabel: string | null;
  /** Técnico en la propuesta (`""` en las paradas sin asignar). */
  readonly technicianId: string;
  readonly technicianName: string;
  /** Posición 1-based dentro de la ruta propuesta. */
  readonly order: number;
  /** "HH:mm" en la zona horaria del negocio. */
  readonly scheduledTime: string;
  /** Llegada estimada real ("HH:mm"). */
  readonly estimatedArrivalTime: string;
  /** Inicio del servicio ("HH:mm"): la llegada o la hora citada si se llega antes. */
  readonly serviceStartTime: string;
  readonly estimatedDriveMinutesFromPrevious: number;
  readonly estimatedServiceMinutes: number;
  readonly distanceMilesFromPrevious: number | null;
  readonly delayMinutes: number | null;
  readonly driveSource?: AssistantDriveSource;
  readonly status: AssistantJobStatus;
  /** Estado actual en la base de datos, para mostrar qué cambia al aplicar. */
  readonly currentTechnicianId: string | null;
  readonly currentTechnicianName: string | null;
  readonly currentSortOrder: number | null;
  readonly hasCoordinates: boolean;
};

export type AssistantRoute = {
  readonly technicianId: string;
  readonly technicianName: string;
  readonly originAddress: string;
  readonly routeGroupIds: readonly string[];
  readonly routeGroupLabels: readonly string[];
  readonly stops: readonly AssistantStop[];
  readonly totalDriveMinutes: number;
  readonly returnDriveMinutes: number;
  readonly totalServiceMinutes: number;
  readonly totalRouteMinutes: number;
  readonly returnDistanceMiles: number | null;
  readonly returnDriveSource?: AssistantDriveSource;
  readonly estimatedReturnTime: string | null;
  /** La ruta termina después de medianoche (`estimatedReturnTime` es del día siguiente). */
  readonly overflowsDay?: boolean;
  readonly conflicts: number;
};

export type AssistantPlanSummary = {
  readonly totalStops: number;
  readonly totalDriveMinutes: number;
  readonly totalServiceMinutes: number;
  readonly totalRouteMinutes: number;
  readonly conflicts: number;
  readonly loadSpread: number;
};

export type AssistantUpdate = {
  readonly jobId: string;
  readonly technicianId: string;
  /** Minuto del día del inicio de servicio (+índice si hay empate). */
  readonly sortOrder: number;
};

export type AssistantPlan = {
  readonly strategy: AssistantStrategy;
  readonly routes: readonly AssistantRoute[];
  /** Trabajos que la estrategia no asignó a ningún técnico. */
  readonly unassigned: readonly AssistantStop[];
  readonly summary: AssistantPlanSummary;
  readonly updates: readonly AssistantUpdate[];
};

export type AssistantPlanResponse = {
  readonly date: string;
  readonly originAddress: string;
  readonly technicians: readonly AssistantTechnician[];
  readonly jobsCount: number;
  readonly excludedCount: number;
  readonly unresolvedGeocodes: number;
  readonly unresolvedJobIds: readonly string[];
  readonly plans: readonly AssistantPlan[];
};

export type AssistantRecalculateRequest = {
  readonly date: string;
  readonly routes: readonly { readonly technicianId: string; readonly jobIds: readonly string[] }[];
};

export type AssistantRecalculateResponse = {
  readonly date: string;
  readonly originAddress: string;
  readonly unresolvedJobIds: readonly string[];
  readonly plan: AssistantPlan;
};

export type AssistantErrorCode = "TOO_MANY_JOBS" | "RATE_LIMITED" | "JOB_NOT_FOUND";

export type AssistantErrorResponse = {
  readonly error: string;
  readonly code?: AssistantErrorCode;
  readonly limit?: number;
  readonly jobIds?: readonly string[];
};
