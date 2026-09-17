import type { DigestWindow } from "@prisma/client";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;

/** Expresiones cron, evaluadas en BUSINESS_TIMEZONE. Idénticas a las del antiguo scripts/cron-worker.cjs. */
export const CRON_SCHEDULES = {
  customerNotifications: "*/2 * * * *",
  recurringPlans: "*/10 * * * *",
  routeAssistantAutoOptimize: "0 7 * * *",
  morningDigest: "30 6 * * *",
  middayDigest: "0 12 * * *",
  eveningDigest: "0 21 * * *",
} as const;

/** Eventos de Notification que el worker convierte en correo al cliente. */
export const CUSTOMER_NOTIFICATION_EVENTS = [
  "SERVICE_SCHEDULED",
  "SERVICE_RESCHEDULED",
  "JOB_COMPLETED",
] as const;
export type CustomerNotificationEvent = (typeof CUSTOMER_NOTIFICATION_EVENTS)[number];

/** Ventanas de digest de cambios (la MORNING es el plan diario). */
export const CHANGE_DIGEST_WINDOWS = ["MIDDAY", "EVENING"] as const satisfies readonly DigestWindow[];
export type ChangeDigestWindow = (typeof CHANGE_DIGEST_WINDOWS)[number];

/** Notificaciones reclamadas por tick. */
export const NOTIFICATION_BATCH_SIZE = 30;
/** Días hacia delante que se materializan los planes recurrentes. */
export const RECURRING_LOOKAHEAD_DAYS = 28;
/** Tiempo que se reutilizan las plantillas de SiteSettings antes de releerlas. */
export const TEMPLATE_CACHE_TTL_MS = MS_PER_MINUTE;
/** Intentos máximos de envío (el inicial incluido) antes de abandonar. */
export const MAX_SEND_ATTEMPTS = 5;
/** Un PROCESSING más antiguo que esto se considera huérfano (proceso caído a mitad de envío). */
export const PROCESSING_ORPHAN_THRESHOLD_MS = 10 * MS_PER_MINUTE;
/** Backoff exponencial de los reintentos: 2, 4, 8, 16... minutos, con tope de una hora. */
export const RETRY_BASE_DELAY_MS = 2 * MS_PER_MINUTE;
export const RETRY_BACKOFF_FACTOR = 2;
export const RETRY_MAX_DELAY_MS = MS_PER_HOUR;
/** Tiempo máximo de espera de la llamada al endpoint interno de optimización de rutas. */
export const ROUTE_OPTIMIZE_TIMEOUT_MS = 5 * MS_PER_MINUTE;
