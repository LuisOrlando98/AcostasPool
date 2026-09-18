export type LogContext = Readonly<Record<string, unknown>>;

export type WorkerLogger = {
  readonly info: (message: string, context?: LogContext) => void;
  readonly warn: (message: string, context?: LogContext) => void;
  readonly error: (message: string, context?: LogContext) => void;
};

type LogSink = (...args: readonly unknown[]) => void;

export const WORKER_LOG_PREFIX = "[cron-worker]";

function bindSink(sink: LogSink, prefix: string) {
  return (message: string, context?: LogContext) => {
    if (context === undefined) {
      sink(`${prefix} ${message}`);
      return;
    }
    sink(`${prefix} ${message}`, context);
  };
}

/** Logger mínimo del worker: info/warn/error sobre la consola con un prefijo fijo. */
export function createLogger(prefix: string = WORKER_LOG_PREFIX): WorkerLogger {
  return {
    info: bindSink((...args) => console.info(...args), prefix),
    warn: bindSink((...args) => console.warn(...args), prefix),
    error: bindSink((...args) => console.error(...args), prefix),
  };
}
