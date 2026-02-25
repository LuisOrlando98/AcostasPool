import { prisma } from "@/lib/db";

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

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
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
