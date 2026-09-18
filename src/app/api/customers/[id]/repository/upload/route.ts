import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  buildCustomerRepositoryRoot,
  sanitizeRepositoryName,
  sanitizeRepositoryPath,
} from "@/lib/customers/repository";
import {
  PRIVATE_ASSET_CACHE_CONTROL,
  storePublicAsset,
} from "@/lib/storage/object-store";
import {
  UPLOAD_SIGNATURE_SAMPLE_BYTES,
  validateUploadFile,
} from "@/lib/storage/upload-validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type ValidatedUpload = {
  file: File;
  contentType: string;
};

function isFilesPath(path: string) {
  return path === "files" || path.startsWith("files/");
}

function sanitizeFileName(name: string) {
  const trimmed = name.trim();
  const extensionIndex = trimmed.lastIndexOf(".");
  if (extensionIndex <= 0) {
    return sanitizeRepositoryName(trimmed, "file");
  }
  const base = sanitizeRepositoryName(trimmed.slice(0, extensionIndex), "file");
  const ext = trimmed
    .slice(extensionIndex + 1)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  return ext ? `${base}.${ext}` : base;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: customerId } = await context.params;
  if (!customerId) {
    return NextResponse.json({ error: "Customer id is required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const pathValue = sanitizeRepositoryPath(String(formData.get("path") ?? "files"));
  if (!isFilesPath(pathValue)) {
    return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files selected" }, { status: 400 });
  }

  const subPath = pathValue === "files" ? "" : pathValue.slice("files/".length);
  const rootPrefix = buildCustomerRepositoryRoot(customerId);

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File ${file.name} exceeds 25MB limit` },
        { status: 400 }
      );
    }
  }

  // Se valida todo el lote antes de escribir nada: basta la cabecera de cada
  // archivo, así un tipo rechazado no deja subidos los archivos anteriores.
  const validatedFiles: ValidatedUpload[] = [];
  for (const file of files) {
    const head = Buffer.from(
      await file.slice(0, UPLOAD_SIGNATURE_SAMPLE_BYTES).arrayBuffer()
    );
    const validation = validateUploadFile({
      fileName: file.name,
      declaredType: file.type,
      bytes: head,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    validatedFiles.push({ file, contentType: validation.contentType });
  }

  for (const { file, contentType } of validatedFiles) {
    const bytes = await file.arrayBuffer();
    const safeName = sanitizeFileName(file.name);
    const storagePath = `${rootPrefix}${subPath ? `${subPath}/` : ""}${safeName}`;
    await storePublicAsset({
      relativePath: storagePath,
      buffer: Buffer.from(bytes),
      contentType,
      cacheControl: PRIVATE_ASSET_CACHE_CONTROL,
    });
  }

  return NextResponse.json({ ok: true, uploaded: files.length });
}
