import type { WorkerLogger } from "@/lib/worker/logger";

/** Contadores que devuelve cada tarea; se registran solo cuando hay actividad. */
export type TaskSummary = Readonly<Record<string, number>>;

export type WorkerTask = {
  readonly name: string;
  readonly schedule: string;
  readonly run: () => Promise<TaskSummary>;
};

export type TaskOutcome = "completed" | "failed" | "skipped";

export type TaskRunner = {
  readonly run: (name: string, task: () => Promise<TaskSummary>) => Promise<TaskOutcome>;
  readonly isRunning: (name: string) => boolean;
};

/** Abstracción de `node-cron.schedule` para poder inyectar un planificador falso en tests. */
export type CronSchedule = (
  expression: string,
  handler: () => void,
  options: { readonly timezone: string }
) => { readonly stop: () => void };

export type ScheduledHandle = {
  readonly name: string;
  readonly stop: () => void;
};

export type OnceResult = {
  readonly completed: number;
  readonly failed: number;
};

function hasActivity(summary: TaskSummary): boolean {
  return Object.values(summary).some((value) => value > 0);
}

/**
 * Ejecuta tareas capturando sus errores y evitando solapamientos: si un tick
 * llega mientras la misma tarea sigue en curso, se omite y se registra.
 */
export function createTaskRunner(logger: WorkerLogger): TaskRunner {
  let running: ReadonlySet<string> = new Set();
  const markRunning = (name: string) => {
    running = new Set([...running, name]);
  };
  const markIdle = (name: string) => {
    running = new Set([...running].filter((entry) => entry !== name));
  };

  return {
    isRunning: (name) => running.has(name),
    async run(name, task) {
      if (running.has(name)) {
        logger.warn(`${name}: tick skipped, previous run still in progress`);
        return "skipped";
      }
      markRunning(name);
      const startedAt = Date.now();
      try {
        const summary = await task();
        if (hasActivity(summary)) {
          logger.info(`${name}: completed`, { ...summary, durationMs: Date.now() - startedAt });
        }
        return "completed";
      } catch (error) {
        logger.error(`${name}: failed`, { error });
        return "failed";
      } finally {
        markIdle(name);
      }
    },
  };
}

export function scheduleTasks(
  schedule: CronSchedule,
  runner: TaskRunner,
  tasks: readonly WorkerTask[],
  timezone: string
): readonly ScheduledHandle[] {
  return tasks.map((task) => {
    const handle = schedule(
      task.schedule,
      () => {
        void runner.run(task.name, task.run);
      },
      { timezone }
    );
    return { name: task.name, stop: handle.stop };
  });
}

/** Ejecuta cada tarea una vez, en orden, y cuenta los resultados (modo `--once`). */
export async function runTasksOnce(
  runner: TaskRunner,
  tasks: readonly WorkerTask[]
): Promise<OnceResult> {
  let completed = 0;
  let failed = 0;
  for (const task of tasks) {
    const outcome = await runner.run(task.name, task.run);
    completed += outcome === "completed" ? 1 : 0;
    failed += outcome === "failed" ? 1 : 0;
  }
  return { completed, failed };
}
