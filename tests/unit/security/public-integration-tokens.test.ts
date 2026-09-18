import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PUBLIC_INTEGRATION_TOKEN,
  getAllowedPublicIntegrationTokens,
  isAllowedPublicIntegrationToken,
} from "@/lib/public-integrations";

const CONFIGURED_TOKEN = "configured-token-0001";
const SECOND_TOKEN = "configured-token-0002";
const PRODUCTION_ENV = { NODE_ENV: "production" } as const;

describe("getAllowedPublicIntegrationTokens", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("reads the comma-separated list from the environment", () => {
    const tokens = getAllowedPublicIntegrationTokens({
      PUBLIC_INTEGRATION_TOKENS: `${CONFIGURED_TOKEN},${SECOND_TOKEN}`,
    });

    expect([...tokens]).toEqual([CONFIGURED_TOKEN, SECOND_TOKEN]);
  });

  it("trims entries and drops empty ones", () => {
    const tokens = getAllowedPublicIntegrationTokens({
      PUBLIC_INTEGRATION_TOKENS: ` ${CONFIGURED_TOKEN} , ,${SECOND_TOKEN}, `,
    });

    expect([...tokens]).toEqual([CONFIGURED_TOKEN, SECOND_TOKEN]);
  });

  it("replaces the built-in token once the variable is set", () => {
    const tokens = getAllowedPublicIntegrationTokens({
      PUBLIC_INTEGRATION_TOKENS: CONFIGURED_TOKEN,
    });

    expect(tokens.has(DEFAULT_PUBLIC_INTEGRATION_TOKEN)).toBe(false);
  });

  it("keeps the built-in token while the variable is unset, so links already sent work", () => {
    const tokens = getAllowedPublicIntegrationTokens({});

    expect([...tokens]).toEqual([DEFAULT_PUBLIC_INTEGRATION_TOKEN]);
  });

  it("falls back to the built-in token when the list has no usable entry", () => {
    const tokens = getAllowedPublicIntegrationTokens({
      PUBLIC_INTEGRATION_TOKENS: " , ",
    });

    expect([...tokens]).toEqual([DEFAULT_PUBLIC_INTEGRATION_TOKEN]);
  });

  it("warns once in production while the variable is unset", () => {
    getAllowedPublicIntegrationTokens(PRODUCTION_ENV);
    getAllowedPublicIntegrationTokens(PRODUCTION_ENV);

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("PUBLIC_INTEGRATION_TOKENS")
    );
  });
});

describe("isAllowedPublicIntegrationToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("accepts a configured token", () => {
    expect(
      isAllowedPublicIntegrationToken(CONFIGURED_TOKEN, {
        PUBLIC_INTEGRATION_TOKENS: CONFIGURED_TOKEN,
      })
    ).toBe(true);
  });

  it("rejects a token that is not in the list", () => {
    expect(
      isAllowedPublicIntegrationToken(DEFAULT_PUBLIC_INTEGRATION_TOKEN, {
        PUBLIC_INTEGRATION_TOKENS: CONFIGURED_TOKEN,
      })
    ).toBe(false);
  });

  it("rejects an empty token", () => {
    expect(
      isAllowedPublicIntegrationToken("  ", {
        PUBLIC_INTEGRATION_TOKENS: CONFIGURED_TOKEN,
      })
    ).toBe(false);
  });
});
