import { beforeEach, describe, expect, it, vi } from "vitest";
import { CRON_SECRET_HEADER } from "@/lib/worker/internal-endpoint";
import { AUTO_OPTIMIZE_PATH, triggerRouteAssistantAutoOptimize } from "@/lib/worker/route-optimize";
import { createLoggerStub } from "./helpers";

const APP_URL = "https://acostaspool.example";
const SECRET = "cron-secret";
const HTTP_OK = 200;
const HTTP_TEMPORARY_REDIRECT = 307;
const HTTP_UNAUTHORIZED = 401;
const LOGIN_REDIRECT = "/login?next=%2Fapi%2Finternal";

type FetchStubOptions = {
  readonly status: number;
  readonly body?: unknown;
  readonly invalidJson?: boolean;
  readonly headers?: Record<string, string>;
};

function createFetchStub({ status, body, invalidJson = false, headers = {} }: FetchStubOptions) {
  return vi.fn(async () => ({
    ok: status === HTTP_OK,
    status,
    headers: new Headers(headers),
    json: async () => {
      if (invalidJson) {
        throw new SyntaxError("Unexpected token <");
      }
      return body;
    },
  })) as unknown as typeof fetch;
}

function buildDeps(fetchImpl: typeof fetch, env = { APP_URL, CRON_SECRET: SECRET }) {
  return { env, logger: createLoggerStub(), fetchImpl };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("triggerRouteAssistantAutoOptimize", () => {
  it("skips the call and warns when APP_URL or CRON_SECRET are missing", async () => {
    const fetchImpl = createFetchStub({ status: HTTP_OK, body: { ok: true } });
    const deps = buildDeps(fetchImpl, { APP_URL, CRON_SECRET: "" });

    const summary = await triggerRouteAssistantAutoOptimize(deps);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(deps.logger.warn).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({ requested: 0, skipped: 1 });
  });

  it("posts to the internal endpoint with the shared secret, no trailing slash and manual redirects", async () => {
    const fetchImpl = createFetchStub({
      status: HTTP_OK,
      body: { ok: true, skipped: true, reason: "disabled" },
    });
    const deps = buildDeps(fetchImpl, { APP_URL: `${APP_URL}/`, CRON_SECRET: SECRET });

    const summary = await triggerRouteAssistantAutoOptimize(deps);

    expect(fetchImpl).toHaveBeenCalledWith(
      `${APP_URL}${AUTO_OPTIMIZE_PATH}`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", [CRON_SECRET_HEADER]: SECRET },
        body: "{}",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      })
    );
    expect(deps.logger.info).toHaveBeenCalledWith(
      "route assistant auto optimize",
      expect.objectContaining({ response: expect.objectContaining({ reason: "disabled" }) })
    );
    expect(summary).toEqual({ requested: 1, skipped: 0 });
  });

  it("throws with the endpoint's error message on a non-2xx response", async () => {
    const fetchImpl = createFetchStub({ status: HTTP_UNAUTHORIZED, body: { error: "Unauthorized" } });

    await expect(triggerRouteAssistantAutoOptimize(buildDeps(fetchImpl))).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("fails instead of following a redirect to the login page", async () => {
    const fetchImpl = createFetchStub({
      status: HTTP_TEMPORARY_REDIRECT,
      headers: { location: LOGIN_REDIRECT },
    });

    await expect(triggerRouteAssistantAutoOptimize(buildDeps(fetchImpl))).rejects.toThrow(
      `unexpected redirect (HTTP ${HTTP_TEMPORARY_REDIRECT}) to ${LOGIN_REDIRECT}`
    );
  });

  it("fails when a 2xx response is not JSON", async () => {
    const fetchImpl = createFetchStub({ status: HTTP_OK, invalidJson: true });

    await expect(triggerRouteAssistantAutoOptimize(buildDeps(fetchImpl))).rejects.toThrow(
      "invalid JSON response (HTTP 200)"
    );
  });
});
