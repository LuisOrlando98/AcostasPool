/**
 * Declaraciones mínimas de node-cron 3.x. El paquete no publica tipos y el
 * proyecto no incluye `@types/node-cron`; solo se declara lo que usa el worker
 * (`scripts/cron-worker.ts`).
 */
declare module "node-cron" {
  export type ScheduleOptions = {
    scheduled?: boolean;
    timezone?: string;
    name?: string;
    recoverMissedExecutions?: boolean;
    runOnInit?: boolean;
  };

  export type ScheduledTask = {
    start: () => void;
    stop: () => void;
  };

  export function schedule(
    expression: string,
    handler: (now: Date | "manual" | "init") => void | Promise<void>,
    options?: ScheduleOptions
  ): ScheduledTask;

  export function validate(expression: string): boolean;
}
