import { describe, expect, it } from "vitest";
import { EnvValidationError, validateEnv } from "@/lib/config/env";
import { reportWorkerEnv, validateWorkerEnv } from "@/lib/worker/env";
import { createLoggerStub } from "./helpers";

const WORKER_ENV = {
  DATABASE_URL: "postgresql://user:secret@localhost:5432/acostaspool",
  APP_URL: "https://acostaspool.example",
  BUSINESS_TIMEZONE: "America/New_York",
} as const;

describe("validateWorkerEnv", () => {
  it("does not require AUTH_SECRET, which only the web service uses", () => {
    const webResult = validateEnv(WORKER_ENV);
    const workerResult = validateWorkerEnv(WORKER_ENV);

    expect(webResult.ok).toBe(false);
    expect(webResult.missingRequired).toContain("AUTH_SECRET");
    expect(workerResult.ok).toBe(true);
    expect(workerResult.missingRequired).toEqual([]);
    expect(workerResult.errors).toEqual([]);
  });

  it("keeps the blocking problems of the variables the worker does use", () => {
    const result = validateWorkerEnv({ ...WORKER_ENV, DATABASE_URL: "mysql://nope" });

    expect(result.ok).toBe(false);
    expect(result.missingRequired).toEqual(["DATABASE_URL"]);
  });

  it("reports degraded integrations as warnings", () => {
    const result = validateWorkerEnv(WORKER_ENV);

    expect(result.warnings.some((message) => message.startsWith("SMTP is not configured"))).toBe(
      true
    );
    expect(result.warnings.some((message) => message.startsWith("CRON_SECRET is not set"))).toBe(
      true
    );
  });
});

describe("reportWorkerEnv", () => {
  it("logs warnings and errors without throwing outside production", () => {
    const logger = createLoggerStub();

    const result = reportWorkerEnv(logger, { ...WORKER_ENV, DATABASE_URL: "", NODE_ENV: "development" });

    expect(result.ok).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls.length).toBeGreaterThan(0);
    expect(logger.warn.mock.calls[0][0]).toMatch(/^\[env\] /);
  });

  it("throws EnvValidationError in production when a blocking variable is missing", () => {
    const logger = createLoggerStub();

    expect(() =>
      reportWorkerEnv(logger, { ...WORKER_ENV, DATABASE_URL: "", NODE_ENV: "production" })
    ).toThrow(EnvValidationError);
  });

  it("starts in production when only web-only variables are missing", () => {
    const logger = createLoggerStub();

    expect(() => reportWorkerEnv(logger, { ...WORKER_ENV, NODE_ENV: "production" })).not.toThrow();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
