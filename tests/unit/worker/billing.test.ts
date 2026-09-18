import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTRACT_REGENERATE_PATH,
  STRIPE_RECONCILE_PATH,
  triggerContractRegeneration,
  triggerStripeReconcile,
  type BillingTriggerDeps,
} from "@/lib/worker/billing";
import { CRON_SECRET_HEADER } from "@/lib/worker/internal-endpoint";
import { createLoggerStub } from "./helpers";

const APP_URL = "https://acostaspool.example";
const SECRET = "cron-secret";
const HTTP_OK = 200;
const HTTP_SERVER_ERROR = 500;

function createFetchStub(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status === HTTP_OK,
    status,
    headers: new Headers(),
    json: async () => body,
  })) as unknown as typeof fetch;
}

function buildDeps(fetchImpl: typeof fetch, cronSecret = SECRET): BillingTriggerDeps {
  return { env: { APP_URL, CRON_SECRET: cronSecret }, logger: createLoggerStub(), fetchImpl };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each([
  {
    label: "contract regeneration",
    path: CONTRACT_REGENERATE_PATH,
    trigger: triggerContractRegeneration,
    body: { ok: true, regeneratedCount: 2, skippedCount: 1 },
  },
  {
    label: "stripe reconcile",
    path: STRIPE_RECONCILE_PATH,
    trigger: triggerStripeReconcile,
    body: { ok: true, checkedCount: 3, correctedCount: 0 },
  },
])("$label", ({ label, path, trigger, body }) => {
  it("posts to its internal endpoint with the shared secret and logs the response", async () => {
    // Arrange
    const fetchImpl = createFetchStub(HTTP_OK, body);
    const deps = buildDeps(fetchImpl);

    // Act
    const summary = await trigger(deps);

    // Assert
    expect(fetchImpl).toHaveBeenCalledWith(
      `${APP_URL}${path}`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", [CRON_SECRET_HEADER]: SECRET },
        body: "{}",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      })
    );
    expect(deps.logger.info).toHaveBeenCalledWith(label, { response: body });
    expect(summary).toEqual({ requested: 1, skipped: 0 });
  });

  it("skips the call and warns when CRON_SECRET is missing", async () => {
    // Arrange
    const fetchImpl = createFetchStub(HTTP_OK, body);
    const deps = buildDeps(fetchImpl, "");

    // Act
    const summary = await trigger(deps);

    // Assert
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(deps.logger.warn).toHaveBeenCalledWith(
      `${label} skipped: missing APP_URL or CRON_SECRET`
    );
    expect(summary).toEqual({ requested: 0, skipped: 1 });
  });

  it("throws with the endpoint's error message on a non-2xx response", async () => {
    // Arrange
    const fetchImpl = createFetchStub(HTTP_SERVER_ERROR, { error: "Stripe unavailable" });

    // Act & Assert
    await expect(trigger(buildDeps(fetchImpl))).rejects.toThrow("Stripe unavailable");
  });
});
