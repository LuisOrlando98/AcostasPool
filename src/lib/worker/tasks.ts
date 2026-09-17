import type { EnvSource } from "@/lib/config/env";
import { CRON_SCHEDULES } from "@/lib/worker/constants";
import { processCustomerNotifications } from "@/lib/worker/customer-notifications";
import { createEmailTemplateSource } from "@/lib/worker/email-templates";
import type { WorkerLogger } from "@/lib/worker/logger";
import { processRecurringPlans } from "@/lib/worker/recurring-plans";
import { triggerRouteAssistantAutoOptimize } from "@/lib/worker/route-optimize";
import type { WorkerTask } from "@/lib/worker/scheduler";
import { retryFailedDigests, sendChangeDigest, sendDailyPlan } from "@/lib/worker/tech-digests";
import type { WorkerDb, WorkerMailer, WorkerTaskDeps } from "@/lib/worker/types";

export type WorkerContext = {
  readonly db: WorkerDb;
  readonly mailer: WorkerMailer;
  readonly logger: WorkerLogger;
  readonly env: EnvSource;
  readonly clock: () => Date;
  readonly fetchImpl: typeof fetch;
};

export const TASK_NAMES = {
  customerNotifications: "customer-notifications",
  digestRetry: "digest-retry",
  recurringPlans: "recurring-plans",
  routeAssistantAutoOptimize: "route-assistant-auto",
  morningDigest: "morning-digest",
  middayDigest: "midday-digest",
  eveningDigest: "evening-digest",
} as const;

/** Tareas del worker con sus expresiones cron; el orden es el de ejecución en modo `--once`. */
export function buildWorkerTasks(context: WorkerContext): readonly WorkerTask[] {
  const { db, mailer, logger, env, clock, fetchImpl } = context;
  const templates = createEmailTemplateSource(db);
  const tickDeps = (): WorkerTaskDeps => ({ db, mailer, logger, templates, now: clock() });

  return [
    {
      name: TASK_NAMES.customerNotifications,
      schedule: CRON_SCHEDULES.customerNotifications,
      run: () => processCustomerNotifications(tickDeps()),
    },
    {
      name: TASK_NAMES.digestRetry,
      schedule: CRON_SCHEDULES.customerNotifications,
      run: () => retryFailedDigests(tickDeps()),
    },
    {
      name: TASK_NAMES.recurringPlans,
      schedule: CRON_SCHEDULES.recurringPlans,
      run: () => processRecurringPlans(tickDeps()),
    },
    {
      name: TASK_NAMES.routeAssistantAutoOptimize,
      schedule: CRON_SCHEDULES.routeAssistantAutoOptimize,
      run: () => triggerRouteAssistantAutoOptimize({ env, logger, fetchImpl }),
    },
    {
      name: TASK_NAMES.morningDigest,
      schedule: CRON_SCHEDULES.morningDigest,
      run: () => sendDailyPlan(tickDeps()),
    },
    {
      name: TASK_NAMES.middayDigest,
      schedule: CRON_SCHEDULES.middayDigest,
      run: () => sendChangeDigest(tickDeps(), "MIDDAY"),
    },
    {
      name: TASK_NAMES.eveningDigest,
      schedule: CRON_SCHEDULES.eveningDigest,
      run: () => sendChangeDigest(tickDeps(), "EVENING"),
    },
  ];
}

export function findTask(tasks: readonly WorkerTask[], name: string): WorkerTask | undefined {
  return tasks.find((task) => task.name === name);
}
