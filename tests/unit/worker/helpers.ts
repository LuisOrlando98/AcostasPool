import { vi, type Mock } from "vitest";
import { getDefaultLocalizedEmailTemplatesConfig } from "@/lib/email-templates";
import type { WorkerLogger } from "@/lib/worker/logger";
import type {
  EmailTemplateSource,
  WorkerDb,
  WorkerMailer,
  WorkerTaskDeps,
} from "@/lib/worker/types";

export type LoggerStub = WorkerLogger & {
  readonly info: Mock;
  readonly warn: Mock;
  readonly error: Mock;
};

export const EMAIL_LOG_ID = "log_1";

export function createLoggerStub(): LoggerStub {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

export function createTemplateSourceStub(): EmailTemplateSource {
  return { load: vi.fn().mockResolvedValue(getDefaultLocalizedEmailTemplatesConfig()) };
}

export function createMailerStub(ok = true): WorkerMailer & Mock {
  const mailer = vi.fn();
  mailer.mockResolvedValue(
    ok
      ? { ok: true, emailLogId: EMAIL_LOG_ID }
      : { ok: false, reason: "send_failed", error: "SMTP down", emailLogId: EMAIL_LOG_ID }
  );
  return mailer;
}

/** Los tests construyen delegados parciales; el cast evita replicar el cliente Prisma completo. */
export function asWorkerDb(mock: unknown): WorkerDb {
  return mock as WorkerDb;
}

export function buildDeps(
  db: unknown,
  now: Date,
  overrides: Partial<Omit<WorkerTaskDeps, "db" | "now">> = {}
): WorkerTaskDeps {
  return {
    db: asWorkerDb(db),
    now,
    mailer: overrides.mailer ?? createMailerStub(),
    logger: overrides.logger ?? createLoggerStub(),
    templates: overrides.templates ?? createTemplateSourceStub(),
  };
}
