import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { signSessionToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME } from "@/lib/auth/config";
import { storePublicAsset } from "@/lib/storage/object-store";
import { buildAvatarAssetPath } from "@/lib/storage/paths";

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
  const avatarUrl = await storePublicAsset({
    relativePath: buildAvatarAssetPath(session.sub, file.name),
    buffer,
    contentType: file.type || undefined,
    cacheControl: "public, max-age=31536000, immutable",
  });
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
