import { prisma } from "@/lib/db";
import type { EnvSource } from "@/lib/config/env";

type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const MAX_STORED_KEYS = 10_000;
const stateByKey = new Map<string, RateLimitState>();

function prune(now: number) {
  for (const [key, state] of stateByKey) {
    if (state.resetAt <= now) {
      stateByKey.delete(key);
    }
  }
  if (stateByKey.size <= MAX_STORED_KEYS) {
    return;
  }
  const ordered = [...stateByKey.entries()].sort(
    (a, b) => a[1].resetAt - b[1].resetAt
  );
  const overflow = stateByKey.size - MAX_STORED_KEYS;
  for (let index = 0; index < overflow; index += 1) {
    stateByKey.delete(ordered[index][0]);
  }
}

export const UNKNOWN_CLIENT_IP = "unknown";

const PRODUCTION_NODE_ENV = "production";
/** Render terminates TLS on one proxy in front of the app. */
const PRODUCTION_TRUSTED_PROXY_HOPS = 1;
/** `next dev` is reached directly: no proxy appends a trustworthy address. */
const DEVELOPMENT_TRUSTED_PROXY_HOPS = 0;

/** One warning per malformed value instead of one per request. */
const warnedProxyHopValues = new Set<string>();

function defaultTrustedProxyHops(env: EnvSource): number {
  return env.NODE_ENV === PRODUCTION_NODE_ENV
    ? PRODUCTION_TRUSTED_PROXY_HOPS
    : DEVELOPMENT_TRUSTED_PROXY_HOPS;
}

/**
 * Number of proxies the app trusts between itself and the client, read from
 * `TRUSTED_PROXY_HOPS`. Defaults to 1 in production (Render) and 0 elsewhere.
 * A non-integer or negative value falls back to the default and is reported.
 */
export function resolveTrustedProxyHops(env: EnvSource = process.env): number {
  const fallback = defaultTrustedProxyHops(env);
  const raw = env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw) {
    return fallback;
  }
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    if (!warnedProxyHopValues.has(raw)) {
      warnedProxyHopValues.add(raw);
      console.warn(
        `Invalid TRUSTED_PROXY_HOPS ("${raw}"): expected a non-negative integer; using ${fallback}.`
      );
    }
    return fallback;
  }
  return hops;
}

/**
 * Client address used as the rate-limit key.
 *
 * `x-forwarded-for` grows left to right: every proxy appends the address it
 * saw, so the entries a client can forge are the leftmost ones and the only
 * trustworthy positions are the last `TRUSTED_PROXY_HOPS` ones. The client is
 * therefore the entry `hops` positions from the end; with 0 trusted hops the
 * header carries no trustworthy entry at all and is ignored. When the chain is
 * shorter than the configured hops every entry was written by a trusted proxy,
 * and the leftmost one is the address the outermost proxy saw.
 */
export function getClientIp(request: Request, env: EnvSource = process.env): string {
  const hops = resolveTrustedProxyHops(env);
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor && hops > 0) {
    const chain = forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const trusted = chain[Math.max(0, chain.length - hops)];
    if (trusted) {
      return trusted;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  return UNKNOWN_CLIENT_IP;
}

function checkRateLimitInMemory({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: RateLimitInput): RateLimitResult {
  prune(now);
  const current = stateByKey.get(key);
  if (!current || current.resetAt <= now) {
    stateByKey.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  current.count += 1;
  const remaining = Math.max(limit - current.count, 0);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((current.resetAt - now) / 1000)
  );

  return {
    allowed: current.count <= limit,
    remaining,
    retryAfterSeconds,
  };
}

export async function checkRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: RateLimitInput): Promise<RateLimitResult> {
  if (limit <= 0 || windowMs <= 0) {
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  }

  const nowDate = new Date(now);

  try {
    if (Math.random() < 0.02) {
      await prisma.rateLimitBucket.deleteMany({
        where: { resetAt: { lt: nowDate } },
      });
    }

    const existing = await prisma.rateLimitBucket.findUnique({
      where: { key },
      select: { count: true, resetAt: true },
    });

    if (!existing || existing.resetAt.getTime() <= now) {
      const resetAt = new Date(now + windowMs);
      await prisma.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return {
        allowed: true,
        remaining: Math.max(limit - 1, 0),
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      };
    }

    const updated = await prisma.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
      select: { count: true, resetAt: true },
    });

    const remaining = Math.max(limit - updated.count, 0);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((updated.resetAt.getTime() - now) / 1000)
    );

    return {
      allowed: updated.count <= limit,
      remaining,
      retryAfterSeconds,
    };
  } catch (error) {
    console.error("Rate limit DB fallback triggered:", error);
    return checkRateLimitInMemory({ key, limit, windowMs, now });
  }
}
