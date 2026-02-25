import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(10),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `auth:reset:ip:${ip}`,
    limit: 12,
    windowMs: 15 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { include: { customer: true } } },
  });

  if (
    !resetToken ||
    resetToken.purpose !== "PASSWORD_RESET" ||
    resetToken.usedAt
  ) {
    return NextResponse.json({ error: "Token invalido" }, { status: 400 });
  }

  if (resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "Token expirado" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user = resetToken.user;
  const isActive =
    user.role === "CUSTOMER" && user.customer
      ? user.customer.estadoCuenta === "ACTIVE"
      : true;
  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { passwordHash, isActive },
  });

  await prisma.passwordResetToken.updateMany({
    where: {
      userId: resetToken.userId,
      purpose: "PASSWORD_RESET",
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
