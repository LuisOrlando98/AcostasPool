import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAssetFileName } from "@/lib/storage/asset-keys";
import { resolveAssetAccess } from "@/lib/storage/asset-access";
import {
  buildContentDisposition,
  resolveContentPolicy,
} from "@/lib/storage/content-type";
import {
  findLocalAssetPath,
  isS3StorageDriver,
  presignStoredAsset,
} from "@/lib/storage/object-store";

/**
 * Única puerta de descarga de archivos almacenados.
 *
 * `GET /api/files/<key>` exige sesión (401), autoriza con `resolveAssetAccess`
 * (403) y solo entonces entrega el archivo:
 * - driver `local`: lo lee del directorio privado (`STORAGE_LOCAL_DIR`, por
 *   defecto `<cwd>/storage/private`) y, como compatibilidad con lo ya subido,
 *   cae a `public/` para los archivos históricos.
 * - driver `s3`: responde 302 a una URL prefirmada de corta duración, de modo
 *   que el bucket pueda estar cerrado al público.
 *
 * Ninguna respuesta se cachea y los formatos que el navegador ejecutaría se
 * fuerzan como descarga.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ key: string[] }>;
};

const SIGNED_URL_TTL_SECONDS = 120;
const REDIRECT_STATUS = 302;
const PRIVATE_CACHE_CONTROL = "private, no-store";
const NO_STORE = "no-store";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "cache-control": NO_STORE } }
  );
}

export async function GET(request: Request, context: RouteContext) {
  const { key: segments } = await context.params;
  const rawKey = (segments ?? []).join("/");
  if (!rawKey) {
    return errorResponse("File key is required", 400);
  }

  const session = await getSession();
  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  const decision = await resolveAssetAccess(session, rawKey);
  if (decision.reason === "invalid-key") {
    return errorResponse("Invalid file key", 400);
  }
  if (decision.reason === "unknown-resource") {
    return errorResponse("File not found", 404);
  }
  if (!decision.allowed) {
    return errorResponse("Forbidden", 403);
  }

  const fileName = getAssetFileName(decision.key);
  const policy = resolveContentPolicy(fileName);
  const contentDisposition = buildContentDisposition(policy.disposition, fileName);

  if (isS3StorageDriver()) {
    try {
      const signedUrl = presignStoredAsset(decision.key, {
        expiresInSeconds: SIGNED_URL_TTL_SECONDS,
        contentType: policy.contentType,
        contentDisposition,
      });
      return NextResponse.redirect(signedUrl, {
        status: REDIRECT_STATUS,
        headers: {
          "cache-control": NO_STORE,
          "x-content-type-options": "nosniff",
        },
      });
    } catch (error) {
      console.error("Signed asset URL failed", { key: decision.key }, error);
      return errorResponse("File not available", 503);
    }
  }

  const absolutePath = await findLocalAssetPath(decision.key);
  if (!absolutePath) {
    return errorResponse("File not found", 404);
  }

  try {
    const buffer = await readFile(absolutePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": policy.contentType,
        "content-length": String(buffer.byteLength),
        "content-disposition": contentDisposition,
        "cache-control": PRIVATE_CACHE_CONTROL,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Local asset read failed", { key: decision.key }, error);
    return errorResponse("File not found", 404);
  }
}
