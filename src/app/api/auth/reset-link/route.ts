import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 2);

  await prisma.passwordResetToken.create({
    data: {
      userId: session.sub,
      token,
      expiresAt,
    },
  });

  const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
  const resetLink = `${baseUrl}/reset?token=${token}`;

  return NextResponse.json({ ok: true, resetLink });
}
