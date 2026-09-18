import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNKNOWN_CLIENT_IP,
  checkRateLimit,
  getClientIp,
  resolveTrustedProxyHops,
} from "@/lib/security/rate-limit";

const dbMock = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { rateLimitBucket: dbMock },
}));

const NOW = Date.UTC(2026, 8, 16, 12, 0, 0);
const WINDOW_MS = 60_000;
const WINDOW_SECONDS = WINDOW_MS / 1000;
const LIMIT = 5;
const PRUNE_PROBABILITY_SKIP = 0.5;
const PRUNE_PROBABILITY_HIT = 0.001;
const DENIED_RETRY_SECONDS = 60;

function requestWithHeaders(headers: Record<string, string>) {
  return new Request("http://localhost/api", { headers });
}

const PRODUCTION_ENV = { NODE_ENV: "production" } as const;
const DEVELOPMENT_ENV = { NODE_ENV: "development" } as const;
const CLIENT_IP = "203.0.113.7";
const SPOOFED_IP = "198.51.100.1";
const PROXY_IP = "192.0.2.10";
const REAL_IP_HEADER_VALUE = "9.9.9.9";

describe("resolveTrustedProxyHops", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("defaults to one trusted proxy in production", () => {
    expect(resolveTrustedProxyHops(PRODUCTION_ENV)).toBe(1);
  });

  it("defaults to no trusted proxy outside production", () => {
    expect(resolveTrustedProxyHops(DEVELOPMENT_ENV)).toBe(0);
    expect(resolveTrustedProxyHops({})).toBe(0);
  });

  it("uses the configured number of hops", () => {
    expect(
      resolveTrustedProxyHops({ ...DEVELOPMENT_ENV, TRUSTED_PROXY_HOPS: " 2 " })
    ).toBe(2);
  });

  it("falls back to the default and warns when the value is not a whole number", () => {
    expect(
      resolveTrustedProxyHops({ ...PRODUCTION_ENV, TRUSTED_PROXY_HOPS: "many" })
    ).toBe(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("TRUSTED_PROXY_HOPS")
    );
  });

  it("falls back to the default when the value is negative", () => {
    expect(
      resolveTrustedProxyHops({ ...PRODUCTION_ENV, TRUSTED_PROXY_HOPS: "-1" })
    ).toBe(1);
  });
});

describe("getClientIp", () => {
  it("takes the last forwarded entry with one trusted proxy, ignoring a forged prefix", () => {
    expect(
      getClientIp(
        requestWithHeaders({ "x-forwarded-for": `${SPOOFED_IP}, ${CLIENT_IP}` }),
        PRODUCTION_ENV
      )
    ).toBe(CLIENT_IP);
  });

  it("skips the extra proxies when more hops are trusted", () => {
    expect(
      getClientIp(
        requestWithHeaders({
          "x-forwarded-for": `${SPOOFED_IP}, ${CLIENT_IP}, ${PROXY_IP}`,
        }),
        { ...PRODUCTION_ENV, TRUSTED_PROXY_HOPS: "2" }
      )
    ).toBe(CLIENT_IP);
  });

  it("uses a single forwarded value, trimmed", () => {
    expect(
      getClientIp(
        requestWithHeaders({ "x-forwarded-for": `  ${CLIENT_IP}  ` }),
        PRODUCTION_ENV
      )
    ).toBe(CLIENT_IP);
  });

  it("takes the leftmost entry when the chain is shorter than the trusted hops", () => {
    expect(
      getClientIp(requestWithHeaders({ "x-forwarded-for": `${CLIENT_IP}, ${PROXY_IP}` }), {
        ...PRODUCTION_ENV,
        TRUSTED_PROXY_HOPS: "5",
      })
    ).toBe(CLIENT_IP);
  });

  it("ignores forged blank entries instead of shifting the chain", () => {
    expect(
      getClientIp(
        requestWithHeaders({ "x-forwarded-for": `, ,${SPOOFED_IP}, ${CLIENT_IP}` }),
        PRODUCTION_ENV
      )
    ).toBe(CLIENT_IP);
  });

  it("ignores x-forwarded-for entirely when no proxy is trusted", () => {
    expect(
      getClientIp(
        requestWithHeaders({ "x-forwarded-for": SPOOFED_IP }),
        DEVELOPMENT_ENV
      )
    ).toBe(UNKNOWN_CLIENT_IP);
  });

  it("falls back to x-real-ip, trimmed", () => {
    expect(
      getClientIp(
        requestWithHeaders({ "x-real-ip": `  ${REAL_IP_HEADER_VALUE} ` }),
        PRODUCTION_ENV
      )
    ).toBe(REAL_IP_HEADER_VALUE);
  });

  it("prefers a trusted x-forwarded-for entry over x-real-ip", () => {
    expect(
      getClientIp(
        requestWithHeaders({
          "x-forwarded-for": CLIENT_IP,
          "x-real-ip": REAL_IP_HEADER_VALUE,
        }),
        PRODUCTION_ENV
      )
    ).toBe(CLIENT_IP);
  });

  it("uses x-real-ip when the forwarded header carries no trustworthy entry", () => {
    expect(
      getClientIp(
        requestWithHeaders({
          "x-forwarded-for": SPOOFED_IP,
          "x-real-ip": REAL_IP_HEADER_VALUE,
        }),
        DEVELOPMENT_ENV
      )
    ).toBe(REAL_IP_HEADER_VALUE);
  });

  it("returns 'unknown' when no headers are present", () => {
    expect(getClientIp(requestWithHeaders({}), PRODUCTION_ENV)).toBe(
      UNKNOWN_CLIENT_IP
    );
  });

  it("returns 'unknown' when both headers are blank", () => {
    expect(
      getClientIp(
        requestWithHeaders({ "x-forwarded-for": " , ", "x-real-ip": "   " }),
        PRODUCTION_ENV
      )
    ).toBe(UNKNOWN_CLIENT_IP);
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dbMock.deleteMany.mockReset().mockResolvedValue({ count: 0 });
    dbMock.findUnique.mockReset().mockResolvedValue(null);
    dbMock.upsert.mockReset().mockResolvedValue(undefined);
    dbMock.update.mockReset();
    vi.spyOn(Math, "random").mockReturnValue(PRUNE_PROBABILITY_SKIP);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("denies immediately when the limit is not positive, without touching the DB", async () => {
    const result = await checkRateLimit({ key: "k", limit: 0, windowMs: WINDOW_MS, now: NOW });

    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: DENIED_RETRY_SECONDS,
    });
    expect(dbMock.findUnique).not.toHaveBeenCalled();
  });

  it("denies immediately when the window is not positive", async () => {
    const result = await checkRateLimit({ key: "k", limit: LIMIT, windowMs: 0, now: NOW });
    expect(result.allowed).toBe(false);
    expect(dbMock.findUnique).not.toHaveBeenCalled();
  });

  it("creates a fresh bucket for an unknown key", async () => {
    const result = await checkRateLimit({ key: "new", limit: LIMIT, windowMs: WINDOW_MS, now: NOW });

    const resetAt = new Date(NOW + WINDOW_MS);
    expect(dbMock.upsert).toHaveBeenCalledWith({
      where: { key: "new" },
      create: { key: "new", count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    expect(result).toEqual({
      allowed: true,
      remaining: LIMIT - 1,
      retryAfterSeconds: WINDOW_SECONDS,
    });
  });

  it("resets an expired bucket instead of incrementing it", async () => {
    dbMock.findUnique.mockResolvedValue({ count: 99, resetAt: new Date(NOW) });

    const result = await checkRateLimit({ key: "old", limit: LIMIT, windowMs: WINDOW_MS, now: NOW });

    expect(dbMock.upsert).toHaveBeenCalledTimes(1);
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(LIMIT - 1);
  });

  it("increments an active bucket and reports the remaining quota", async () => {
    const resetAt = new Date(NOW + 30_000);
    dbMock.findUnique.mockResolvedValue({ count: 1, resetAt });
    dbMock.update.mockResolvedValue({ count: 2, resetAt });

    const result = await checkRateLimit({ key: "active", limit: LIMIT, windowMs: WINDOW_MS, now: NOW });

    expect(dbMock.update).toHaveBeenCalledWith({
      where: { key: "active" },
      data: { count: { increment: 1 } },
      select: { count: true, resetAt: true },
    });
    expect(result).toEqual({ allowed: true, remaining: LIMIT - 2, retryAfterSeconds: 30 });
  });

  it("allows the request that exactly reaches the limit and denies the next", async () => {
    const resetAt = new Date(NOW + 30_000);
    dbMock.findUnique.mockResolvedValue({ count: LIMIT - 1, resetAt });

    dbMock.update.mockResolvedValueOnce({ count: LIMIT, resetAt });
    const atLimit = await checkRateLimit({ key: "edge", limit: LIMIT, windowMs: WINDOW_MS, now: NOW });
    expect(atLimit).toEqual({ allowed: true, remaining: 0, retryAfterSeconds: 30 });

    dbMock.update.mockResolvedValueOnce({ count: LIMIT + 1, resetAt });
    const overLimit = await checkRateLimit({ key: "edge", limit: LIMIT, windowMs: WINDOW_MS, now: NOW });
    expect(overLimit).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 30 });
  });

  it("never reports less than one second to retry", async () => {
    const resetAt = new Date(NOW + 10);
    dbMock.findUnique.mockResolvedValue({ count: 1, resetAt });
    dbMock.update.mockResolvedValue({ count: 2, resetAt });

    const result = await checkRateLimit({ key: "soon", limit: LIMIT, windowMs: WINDOW_MS, now: NOW });
    expect(result.retryAfterSeconds).toBe(1);
  });

  it("rounds the window up to whole seconds for a fresh bucket", async () => {
    const result = await checkRateLimit({ key: "frac", limit: LIMIT, windowMs: 1500, now: NOW });
    expect(result.retryAfterSeconds).toBe(2);
  });

  it("reports zero remaining for a limit of one on the first hit", async () => {
    const result = await checkRateLimit({ key: "one", limit: 1, windowMs: WINDOW_MS, now: NOW });
    expect(result).toEqual({ allowed: true, remaining: 0, retryAfterSeconds: WINDOW_SECONDS });
  });

  it("prunes expired buckets only when the random roll is below 2%", async () => {
    await checkRateLimit({ key: "p1", limit: LIMIT, windowMs: WINDOW_MS, now: NOW });
    expect(dbMock.deleteMany).not.toHaveBeenCalled();

    vi.spyOn(Math, "random").mockReturnValue(PRUNE_PROBABILITY_HIT);
    await checkRateLimit({ key: "p2", limit: LIMIT, windowMs: WINDOW_MS, now: NOW });
    expect(dbMock.deleteMany).toHaveBeenCalledWith({
      where: { resetAt: { lt: new Date(NOW) } },
    });
  });

  it("falls back to the in-memory limiter and logs when the DB fails", async () => {
    dbMock.findUnique.mockRejectedValue(new Error("db down"));

    const result = await checkRateLimit({ key: "mem-first", limit: LIMIT, windowMs: WINDOW_MS, now: NOW });

    expect(console.error).toHaveBeenCalledWith(
      "Rate limit DB fallback triggered:",
      expect.any(Error)
    );
    expect(result).toEqual({
      allowed: true,
      remaining: LIMIT - 1,
      retryAfterSeconds: WINDOW_SECONDS,
    });
  });

  it("counts consecutive in-memory hits and denies past the limit", async () => {
    dbMock.findUnique.mockRejectedValue(new Error("db down"));
    const input = { key: "mem-count", limit: 2, windowMs: WINDOW_MS };

    const first = await checkRateLimit({ ...input, now: NOW });
    const second = await checkRateLimit({ ...input, now: NOW + 1_000 });
    const third = await checkRateLimit({ ...input, now: NOW + 2_000 });

    expect(first).toEqual({ allowed: true, remaining: 1, retryAfterSeconds: WINDOW_SECONDS });
    expect(second).toEqual({ allowed: true, remaining: 0, retryAfterSeconds: WINDOW_SECONDS - 1 });
    expect(third).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: WINDOW_SECONDS - 2 });
  });

  it("starts a new in-memory window once the previous one expired", async () => {
    dbMock.findUnique.mockRejectedValue(new Error("db down"));
    const input = { key: "mem-expire", limit: 1, windowMs: WINDOW_MS };

    await checkRateLimit({ ...input, now: NOW });
    const denied = await checkRateLimit({ ...input, now: NOW + 1 });
    const renewed = await checkRateLimit({ ...input, now: NOW + WINDOW_MS });

    expect(denied.allowed).toBe(false);
    expect(renewed).toEqual({ allowed: true, remaining: 0, retryAfterSeconds: WINDOW_SECONDS });
  });

  it("also falls back when the prune query fails", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PRUNE_PROBABILITY_HIT);
    dbMock.deleteMany.mockRejectedValue(new Error("prune failed"));

    const result = await checkRateLimit({ key: "mem-prune", limit: LIMIT, windowMs: WINDOW_MS, now: NOW });

    expect(dbMock.findUnique).not.toHaveBeenCalled();
    expect(result.allowed).toBe(true);
  });
});
