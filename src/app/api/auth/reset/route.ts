import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

export async function POST(request: Request) {
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

  if (!resetToken || resetToken.usedAt) {
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

  await prisma.passwordResetToken.update({
    where: { id: resetToken.id },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
