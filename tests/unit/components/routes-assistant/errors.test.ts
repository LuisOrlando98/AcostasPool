import { describe, expect, it } from "vitest";
import { AssistantRequestError } from "@/components/routes/assistant/api";
import {
  assistantErrorCodeKey,
  describeAssistantError,
} from "@/components/routes/assistant/errors";

const FALLBACK = "fallback message";

/** `t` de prueba: devuelve la clave con sus valores, para ver qué se pediría. */
const t = (key: string, values?: Record<string, string | number>) =>
  values && Object.keys(values).length > 0
    ? `${key}(${Object.entries(values)
        .map(([name, value]) => `${name}=${value}`)
        .join(",")})`
    : key;

describe("assistantErrorCodeKey", () => {
  it("maps every documented code to its own key", () => {
    expect(assistantErrorCodeKey("TOO_MANY_JOBS")).toBe(
      "admin.routes.assistant.errors.tooManyJobs"
    );
    expect(assistantErrorCodeKey("RATE_LIMITED")).toBe(
      "admin.routes.assistant.errors.rateLimited"
    );
    expect(assistantErrorCodeKey("JOB_NOT_FOUND")).toBe(
      "admin.routes.assistant.errors.jobNotFound"
    );
    expect(assistantErrorCodeKey("PROPERTY_NOT_FOUND")).toBe(
      "admin.routes.assistant.errors.propertyNotFound"
    );
  });
});

describe("describeAssistantError", () => {
  it("translates the code and keeps the server text as detail", () => {
    const error = new AssistantRequestError("Too many jobs", {
      code: "TOO_MANY_JOBS",
      limit: 200,
      detail: "Too many jobs",
    });

    expect(describeAssistantError(error, t, FALLBACK)).toBe(
      "admin.routes.assistant.errors.withDetail(" +
        "message=admin.routes.assistant.errors.tooManyJobs(limit=200)," +
        "detail=Too many jobs)"
    );
  });

  it("omits the detail when the server sent no text", () => {
    const error = new AssistantRequestError(FALLBACK, { code: "RATE_LIMITED" });

    expect(describeAssistantError(error, t, FALLBACK)).toBe(
      "admin.routes.assistant.errors.rateLimited(limit=0)"
    );
  });

  it("uses the server message when the response carries no code", () => {
    const error = new AssistantRequestError("Invalid plan template", {
      detail: "Invalid plan template",
    });

    expect(describeAssistantError(error, t, FALLBACK)).toBe("Invalid plan template");
  });

  it("falls back for a non-Error value or an empty message", () => {
    expect(describeAssistantError("boom", t, FALLBACK)).toBe(FALLBACK);
    expect(describeAssistantError(new Error(""), t, FALLBACK)).toBe(FALLBACK);
  });
});
