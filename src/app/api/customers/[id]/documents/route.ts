import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { storePublicAsset } from "@/lib/storage/object-store";
import { buildCustomerDocumentAssetPath } from "@/lib/storage/paths";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_CATEGORIES = new Set([
  "GENERAL",
  "CONTRACT",
  "REPORT",
  "INVOICE_ATTACHMENT",
  "PHOTO",
]);

function normalizeCategory(value: string) {
  const normalized = value.trim().toUpperCase();
  if (ALLOWED_CATEGORIES.has(normalized)) {
    return normalized;
  }
  return "GENERAL";
}

function normalizeTitle(value: string) {
  const trimmed = value.trim();
  return trimmed || "document";
}

async function hasTechAccessToCustomer(userId: string, customerId: string) {
  const technician = await prisma.technician.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!technician) {
    return false;
  }

  const jobsCount = await prisma.job.count({
    where: {
      customerId,
      technicianId: technician.id,
    },
  });

  return jobsCount > 0;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || !["ADMIN", "TECH"].includes(session.role)) {
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

  if (session.role === "TECH") {
    const canUpload = await hasTechAccessToCustomer(session.sub, customerId);
    if (!canUpload) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const formData = await request.formData();
  const files = formData.getAll("files");
  const singleFile = formData.get("file");
  const fileEntries = [...files, ...(singleFile ? [singleFile] : [])].filter(
    (entry): entry is File => entry instanceof File
  );

  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "At least one file is required" }, { status: 400 });
  }

  const descriptionRaw = formData.get("description");
  const description =
    typeof descriptionRaw === "string" && descriptionRaw.trim()
      ? descriptionRaw.trim()
      : null;
  const categoryRaw = formData.get("category");
  const category = normalizeCategory(
    typeof categoryRaw === "string" ? categoryRaw : "GENERAL"
  );

  const createdDocuments = [];
  for (const file of fileEntries) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File ${file.name} exceeds 20MB limit` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileUrl = await storePublicAsset({
      relativePath: buildCustomerDocumentAssetPath(customerId, file.name),
      buffer,
      contentType: file.type || undefined,
      cacheControl: "public, max-age=31536000, immutable",
    });

    const document = await prisma.customerDocument.create({
      data: {
        customerId,
        uploadedByUserId: session.sub,
        title: normalizeTitle(file.name),
        description,
        category,
        fileUrl,
        mimeType: file.type || null,
        sizeBytes: file.size || null,
      },
      select: {
        id: true,
        title: true,
        category: true,
        fileUrl: true,
        createdAt: true,
      },
    });

    createdDocuments.push(document);
  }

  return NextResponse.json({ ok: true, documents: createdDocuments });
}
