import { NextResponse } from "next/server";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { signSessionToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME } from "@/lib/auth/config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = file.name.replace(/[^a-zA-Z0-9-_.]/g, "_");
  const fileName = `${Date.now()}-${safeName}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
  await mkdir(uploadDir, { recursive: true });
  const outputPath = path.join(uploadDir, fileName);
  await writeFile(outputPath, buffer);

  const avatarUrl = `/uploads/avatars/${fileName}`;
  const user = await prisma.user.update({
    where: { id: session.sub },
    data: { avatarUrl },
  });

  const token = await signSessionToken({
    sub: user.id,
    email: user.email,
    name: user.fullName,
    role: user.role,
    avatarUrl: user.avatarUrl,
  });

  const response = NextResponse.json({ ok: true, avatarUrl });
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}
