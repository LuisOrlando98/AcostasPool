import { schedule as scheduleCron } from "node-cron";
import { prisma } from "@/lib/db";
import { sendMailAndLog } from "@/lib/mail/transport";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import { reportWorkerEnv } from "@/lib/worker/env";
import { createLogger } from "@/lib/worker/logger";
import {
  createTaskRunner,
  runTasksOnce,
  scheduleTasks,
  type CronSchedule,
  type ScheduledHandle,
  type TaskRunner,
  type WorkerTask,
} from "@/lib/worker/scheduler";
import { buildWorkerTasks, findTask, TASK_NAMES } from "@/lib/worker/tasks";

/**
 * Worker cron (Render: `npm run worker:cron`, es decir `tsx scripts/cron-worker.ts`).
 *
 * Sin argumentos programa las tareas de `@/lib/worker/tasks` en BUSINESS_TIMEZONE
 * y ejecuta una vez los planes recurrentes al arrancar. Con `--once` ejecuta cada
 * tarea una sola vez, en orden, y termina (código 1 si alguna falló).
 */

const ONCE_FLAG = "--once";
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const SHUTDOWN_SIGNALS = ["SIGTERM", "SIGINT"] as const;

const logger = createLogger();

const cronSchedule: CronSchedule = (expression, handler, options) =>
  scheduleCron(expression, handler, { timezone: options.timezone });

async function disconnectAndExit(code: number): Promise<never> {
  await prisma.$disconnect();
  process.exit(code);
}

async function runOnce(runner: TaskRunner, tasks: readonly WorkerTask[]) {
  const { completed, failed } = await runTasksOnce(runner, tasks);
  logger.info(`${ONCE_FLAG}: ${completed} task(s) completed, ${failed} failed`);
  return disconnectAndExit(failed > 0 ? EXIT_FAILURE : EXIT_SUCCESS);
}

function registerShutdown(handles: readonly ScheduledHandle[]) {
  SHUTDOWN_SIGNALS.forEach((signal) => {
    process.on(signal, () => {
      logger.info(`${signal} received, stopping`);
      handles.forEach((handle) => handle.stop());
      void disconnectAndExit(EXIT_SUCCESS);
    });
  });
}

async function main() {
  const once = process.argv.includes(ONCE_FLAG);
  reportWorkerEnv(logger);
  logger.info(`starting with TZ=${BUSINESS_TIMEZONE}${once ? ` (${ONCE_FLAG})` : ""}`);

  const tasks = buildWorkerTasks({
    db: prisma,
    mailer: sendMailAndLog,
    logger,
    env: process.env,
    clock: () => new Date(),
    fetchImpl: fetch,
  });
  const runner = createTaskRunner(logger);

  if (once) {
    await runOnce(runner, tasks);
    return;
  }

  const handles = scheduleTasks(cronSchedule, runner, tasks, BUSINESS_TIMEZONE);
  tasks.forEach((task) => logger.info(`scheduled ${task.name} (${task.schedule})`));
  registerShutdown(handles);

  const recurringPlans = findTask(tasks, TASK_NAMES.recurringPlans);
  if (recurringPlans) {
    await runner.run(recurringPlans.name, recurringPlans.run);
  }
}

main().catch((error: unknown) => {
  logger.error("failed to start", { error });
  process.exit(EXIT_FAILURE);
});
