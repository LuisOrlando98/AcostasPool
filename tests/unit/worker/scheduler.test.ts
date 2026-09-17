import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTaskRunner,
  runTasksOnce,
  scheduleTasks,
  type CronSchedule,
  type WorkerTask,
} from "@/lib/worker/scheduler";
import { createLoggerStub } from "./helpers";

const TASK_NAME = "customer-notifications";
const TIMEZONE = "America/New_York";

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTaskRunner", () => {
  it("skips and logs a tick that arrives while the same task is still running", async () => {
    const logger = createLoggerStub();
    const runner = createTaskRunner(logger);
    const pending = deferred<{ sent: number }>();

    const first = runner.run(TASK_NAME, () => pending.promise);
    const second = await runner.run(TASK_NAME, async () => ({ sent: 1 }));

    expect(second).toBe("skipped");
    expect(runner.isRunning(TASK_NAME)).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      `${TASK_NAME}: tick skipped, previous run still in progress`
    );

    pending.resolve({ sent: 1 });
    expect(await first).toBe("completed");
    expect(runner.isRunning(TASK_NAME)).toBe(false);
    expect(await runner.run(TASK_NAME, async () => ({ sent: 0 }))).toBe("completed");
  });

  it("runs different tasks concurrently", async () => {
    const runner = createTaskRunner(createLoggerStub());
    const pending = deferred<{ sent: number }>();

    const first = runner.run("a", () => pending.promise);
    const second = await runner.run("b", async () => ({ sent: 0 }));

    expect(second).toBe("completed");
    pending.resolve({ sent: 0 });
    expect(await first).toBe("completed");
  });

  it("catches failures, logs them and releases the task", async () => {
    const logger = createLoggerStub();
    const runner = createTaskRunner(logger);

    const outcome = await runner.run(TASK_NAME, async () => {
      throw new Error("boom");
    });

    expect(outcome).toBe("failed");
    expect(logger.error).toHaveBeenCalledWith(
      `${TASK_NAME}: failed`,
      expect.objectContaining({ error: expect.any(Error) })
    );
    expect(runner.isRunning(TASK_NAME)).toBe(false);
  });

  it("logs the summary only when the task did something", async () => {
    const logger = createLoggerStub();
    const runner = createTaskRunner(logger);

    await runner.run(TASK_NAME, async () => ({ sent: 0, failed: 0 }));
    expect(logger.info).not.toHaveBeenCalled();

    await runner.run(TASK_NAME, async () => ({ sent: 2, failed: 0 }));
    expect(logger.info).toHaveBeenCalledWith(
      `${TASK_NAME}: completed`,
      expect.objectContaining({ sent: 2, failed: 0, durationMs: expect.any(Number) })
    );
  });
});

describe("scheduleTasks", () => {
  it("registers every task with its cron expression and the business time zone", async () => {
    const run = vi.fn(async () => ({ sent: 1 }));
    const tasks: WorkerTask[] = [
      { name: "a", schedule: "*/2 * * * *", run },
      { name: "b", schedule: "0 7 * * *", run },
    ];
    const stop = vi.fn();
    const handlers: Array<() => void> = [];
    const schedule = vi.fn<CronSchedule>((_expression, handler) => {
      handlers.push(handler);
      return { stop };
    });
    const runner = createTaskRunner(createLoggerStub());

    const handles = scheduleTasks(schedule, runner, tasks, TIMEZONE);

    expect(schedule).toHaveBeenCalledTimes(2);
    expect(schedule).toHaveBeenNthCalledWith(1, "*/2 * * * *", expect.any(Function), {
      timezone: TIMEZONE,
    });
    expect(schedule).toHaveBeenNthCalledWith(2, "0 7 * * *", expect.any(Function), {
      timezone: TIMEZONE,
    });
    expect(handles.map((handle) => handle.name)).toEqual(["a", "b"]);

    handlers[0]();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    handles[0].stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe("runTasksOnce", () => {
  it("runs every task sequentially and counts completed and failed runs", async () => {
    const order: string[] = [];
    const tasks: WorkerTask[] = [
      {
        name: "ok",
        schedule: "* * * * *",
        run: async () => {
          order.push("ok");
          return { sent: 1 };
        },
      },
      {
        name: "broken",
        schedule: "* * * * *",
        run: async () => {
          order.push("broken");
          throw new Error("boom");
        },
      },
    ];

    const result = await runTasksOnce(createTaskRunner(createLoggerStub()), tasks);

    expect(order).toEqual(["ok", "broken"]);
    expect(result).toEqual({ completed: 1, failed: 1 });
  });
});
