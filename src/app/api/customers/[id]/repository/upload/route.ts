import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  buildCustomerRepositoryRoot,
  sanitizeRepositoryName,
  sanitizeRepositoryPath,
} from "@/lib/customers/repository";
import { storePublicAsset } from "@/lib/storage/object-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

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

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const safeName = sanitizeFileName(file.name);
    const storagePath = `${rootPrefix}${subPath ? `${subPath}/` : ""}${safeName}`;
    await storePublicAsset({
      relativePath: storagePath,
      buffer: Buffer.from(bytes),
      contentType: file.type || undefined,
      cacheControl: "public, max-age=31536000, immutable",
    });
  }

  return NextResponse.json({ ok: true, uploaded: files.length });
}
