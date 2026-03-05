import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { normalizeEmail } from "@/lib/auth/email";
import { sendPasswordResetEmail } from "@/lib/auth/password-reset";

const forgotSchema = z.object({
  email: z.string().email(),
});

const GENERIC_RESPONSE = {
  ok: true,
  message: "If the account exists, a reset link was sent.",
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipRate = await checkRateLimit({
    key: `auth:forgot:ip:${ip}`,
    limit: 12,
    windowMs: 60 * 60_000,
  });
  if (!ipRate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipRate.retryAfterSeconds) },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const email = normalizeEmail(parsed.data.email);
  const emailRate = await checkRateLimit({
    key: `auth:forgot:email:${email}`,
    limit: 6,
    windowMs: 60 * 60_000,
  });
  if (!emailRate.allowed) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      locale: true,
    },
  });

  if (user) {
    await sendPasswordResetEmail({
      userId: user.id,
      recipientEmail: user.email,
      recipientName: user.fullName,
      baseUrl: process.env.APP_URL ?? new URL(request.url).origin,
      locale: user.locale,
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
