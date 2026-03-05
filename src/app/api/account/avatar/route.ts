import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { signSessionToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME } from "@/lib/auth/config";
import { storePublicAsset } from "@/lib/storage/object-store";
import { buildAvatarAssetPath } from "@/lib/storage/paths";

export const runtime = "nodejs";
const MAX_AVATAR_SIDE = 700;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

type AvatarOutput = {
  format: "jpeg" | "png" | "webp";
  contentType: string;
  extension: string;
};

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return fileName.slice(dotIndex + 1).trim().toLowerCase();
}

function isAllowedImage(file: File) {
  const mimeType = (file.type || "").toLowerCase();
  if (ALLOWED_MIME_TYPES.has(mimeType)) {
    return true;
  }
  return ALLOWED_EXTENSIONS.has(getFileExtension(file.name));
}

function resolveInputImageType(file: File) {
  const mimeType = (file.type || "").toLowerCase();
  if (ALLOWED_MIME_TYPES.has(mimeType)) {
    return mimeType;
  }

  const extension = getFileExtension(file.name);
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return "image/jpeg";
}

function getAvatarOutput(fileType: string): AvatarOutput {
  if (fileType === "image/png") {
    return { format: "png", contentType: "image/png", extension: "png" };
  }
  if (fileType === "image/webp") {
    return { format: "webp", contentType: "image/webp", extension: "webp" };
  }
  return { format: "jpeg", contentType: "image/jpeg", extension: "jpg" };
}

async function normalizeAvatar(buffer: Buffer, fileType: string) {
  const sharp = (await import("sharp")).default;
  const output = getAvatarOutput(fileType);

  let pipeline = sharp(buffer)
    .rotate()
    .resize(MAX_AVATAR_SIDE, MAX_AVATAR_SIDE, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: true,
    });

  if (output.format === "png") {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else if (output.format === "webp") {
    pipeline = pipeline.webp({ quality: 90 });
  } else {
    pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
  }

  return {
    buffer: await pipeline.toBuffer(),
    contentType: output.contentType,
    extension: output.extension,
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUser = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, role: true, fullName: true },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }
  if (!isAllowedImage(file)) {
    return NextResponse.json(
      { error: "Unsupported format. Use JPG, JPEG, PNG, GIF, or WEBP." },
      { status: 415 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const inputImageType = resolveInputImageType(file);
  let normalized;
  try {
    normalized = await normalizeAvatar(buffer, inputImageType);
  } catch (error) {
    console.error("Avatar normalization failed", error);
    return NextResponse.json({ error: "Unable to process image" }, { status: 400 });
  }

  let avatarUrl: string;
  try {
    avatarUrl = await storePublicAsset({
      relativePath: buildAvatarAssetPath(
        currentUser.role,
        currentUser.fullName,
        `avatar.${normalized.extension}`
      ),
      buffer: normalized.buffer,
      contentType: normalized.contentType,
      cacheControl: "public, max-age=31536000, immutable",
    });
  } catch (error) {
    console.error("Avatar storage failed", error);
    return NextResponse.json(
      {
        error:
          "No pudimos guardar tu foto en este momento. Verifica la configuracion de almacenamiento.",
      },
      { status: 503 }
    );
  }

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
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    priority: "high",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}
