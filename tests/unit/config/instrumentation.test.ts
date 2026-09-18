import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_SECRET_MIN_LENGTH } from "@/lib/config/env";

type InstrumentationModule = typeof import("@/instrumentation");

const VALID_REQUIRED = {
  DATABASE_URL: "postgresql://user:secret@localhost:5432/acostaspool",
  AUTH_SECRET: "a".repeat(AUTH_SECRET_MIN_LENGTH),
  APP_URL: "https://acostaspool.example",
} as const;

const MISSING_REQUIRED = {
  DATABASE_URL: "",
  AUTH_SECRET: "",
  APP_URL: "",
} as const;

/**
 * `register()` reads `process.env` at call time, so each scenario stubs the
 * environment and imports a fresh copy of the hook.
 */
async function loadInstrumentation(
  env: Readonly<Record<string, string>>
): Promise<InstrumentationModule> {
  vi.resetModules();
  Object.entries(env).forEach(([name, value]) => vi.stubEnv(name, value));
  return import("@/instrumentation");
}

describe("instrumentation register", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does nothing outside the Node.js runtime", async () => {
    const { register } = await loadInstrumentation({
      ...MISSING_REQUIRED,
      NEXT_RUNTIME: "edge",
      NODE_ENV: "production",
    });

    await expect(register()).resolves.toBeUndefined();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs the missing required variables without throwing outside production", async () => {
    const { register } = await loadInstrumentation({
      ...MISSING_REQUIRED,
      NEXT_RUNTIME: "nodejs",
      NODE_ENV: "development",
    });

    await expect(register()).resolves.toBeUndefined();

    const logged = errorSpy.mock.calls.map((call) => String(call[0]));
    expect(logged.some((line) => line.includes("DATABASE_URL"))).toBe(true);
    expect(logged.some((line) => line.includes("AUTH_SECRET"))).toBe(true);
    expect(logged.some((line) => line.includes("APP_URL"))).toBe(true);
  });

  it("throws in production when a required variable is missing", async () => {
    const { register } = await loadInstrumentation({
      ...MISSING_REQUIRED,
      NEXT_RUNTIME: "nodejs",
      NODE_ENV: "production",
    });

    await expect(register()).rejects.toThrow(/Invalid environment configuration/);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("only warns about degraded features when the configuration is valid in production", async () => {
    const { register } = await loadInstrumentation({
      ...VALID_REQUIRED,
      NEXT_RUNTIME: "nodejs",
      NODE_ENV: "production",
      STORAGE_DRIVER: "local",
    });

    await expect(register()).resolves.toBeUndefined();

    expect(errorSpy).not.toHaveBeenCalled();
    const warned = warnSpy.mock.calls.map((call) => String(call[0]));
    expect(warned.every((line) => line.startsWith("[env]"))).toBe(true);
    expect(warned.some((line) => line.includes("Pusher"))).toBe(true);
  });
});
