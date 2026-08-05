import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { sendPasswordResetEmail } from "@/lib/auth/password-reset";
import { getPublicAppUrl } from "@/lib/app-url";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `auth:reset-link:ip:${ip}`,
    limit: 8,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }
  const emailRate = await checkRateLimit({
    key: `auth:reset-link:user:${session.sub}`,
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!emailRate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(emailRate.retryAfterSeconds) },
      }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, fullName: true, isActive: true, locale: true },
  });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sent = await sendPasswordResetEmail({
    userId: user.id,
    recipientEmail: user.email,
    recipientName: user.fullName,
    baseUrl: getPublicAppUrl(),
    locale: user.locale,
  });

  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
