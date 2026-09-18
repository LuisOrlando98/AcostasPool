import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTranslator,
  humanizeMissingKey,
  translate,
  translatePlural,
  type Messages,
} from "@/i18n/core";

const messages = { greeting: "Hi {{name}}" } as unknown as Messages;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("humanizeMissingKey", () => {
  it("turns the last camelCase segment of a key into readable words", () => {
    expect(humanizeMissingKey("client.request.errors.availableDays")).toBe(
      "Available Days"
    );
    expect(humanizeMissingKey("nav.client.website")).toBe("Website");
  });

  it("splits snake_case and kebab-case segments too", () => {
    expect(humanizeMissingKey("errors.network_timeout")).toBe("Network timeout");
    expect(humanizeMissingKey("errors.not-found")).toBe("Not found");
  });

  it("keeps the key when the last segment is empty", () => {
    expect(humanizeMissingKey("")).toBe("");
    expect(humanizeMissingKey("notifications.")).toBe("notifications.");
  });
});

describe("missing key fallback", () => {
  it("returns the raw key outside production so tests and warnings can spot it", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(translate(messages, "missing.testEnv")).toBe("missing.testEnv");
  });

  it("never renders a raw key in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(translate(messages, "client.request.errors.availableDays")).toBe(
      "Available Days"
    );
    expect(createTranslator(messages)("nav.client.otherServices")).toBe(
      "Other Services"
    );
    expect(translatePlural(messages, "photos.count", 2)).toBe("Count");
  });

  it("does not touch keys that resolve", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(translate(messages, "greeting", { name: "Ana" })).toBe("Hi Ana");
  });
});
