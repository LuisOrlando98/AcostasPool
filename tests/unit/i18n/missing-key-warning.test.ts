import { afterEach, describe, expect, it, vi } from "vitest";
import { translate, type Messages } from "@/i18n/core";

const messages = { greeting: "Hi" } as unknown as Messages;

/**
 * El registro de claves avisadas vive en el módulo, así que cada caso usa
 * claves propias para no depender del orden de ejecución.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("missing key warning", () => {
  it("warns once per missing key in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(translate(messages, "missing.devOnce")).toBe("missing.devOnce");
    expect(translate(messages, "missing.devOnce")).toBe("missing.devOnce");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[i18n] missing translation key: "missing.devOnce"'
    );
  });

  it("warns separately for each distinct missing key", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    translate(messages, "missing.devFirst");
    translate(messages, "missing.devSecond");

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("does not warn for a key that resolves to a string", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(translate(messages, "greeting")).toBe("Hi");

    expect(warn).not.toHaveBeenCalled();
  });

  it("stays silent in test", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(process.env.NODE_ENV).toBe("test");
    expect(translate(messages, "missing.testEnv")).toBe("missing.testEnv");

    expect(warn).not.toHaveBeenCalled();
  });

  it("stays silent in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(translate(messages, "missing.prodEnv")).toBe("missing.prodEnv");

    expect(warn).not.toHaveBeenCalled();
  });
});
