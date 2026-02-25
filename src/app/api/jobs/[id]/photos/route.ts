import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/create";
import { logAuditEvent } from "@/lib/audit/log";
import { storePublicAsset } from "@/lib/storage/object-store";
import { buildJobPhotoAssetPath } from "@/lib/storage/paths";

export const runtime = "nodejs";

const PHOTO_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const PHOTO_EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const MAX_FILES_PER_REQUEST = 12;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE_BYTES = 35 * 1024 * 1024;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }
  return fileName.slice(dotIndex + 1).trim().toLowerCase();
}

function resolvePhotoContentType(file: File) {
  const mime = (file.type || "").trim().toLowerCase();
  if (PHOTO_MIME_TO_EXT[mime]) {
    return mime;
  }
  const ext = getFileExtension(file.name);
  return PHOTO_EXT_TO_MIME[ext] ?? null;
}

function buildSafePhotoName(index: number, contentType: string) {
  const extension = PHOTO_MIME_TO_EXT[contentType] ?? "jpg";
  return `photo-${Date.now()}-${index}-${crypto.randomUUID()}.${extension}`;
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const session = await getSession();
  if (!session || !["TECH", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: jobId } = await context.params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { technician: { include: { user: true } } },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (session.role === "TECH" && job.technician?.userId !== session.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files");
  const legacyFile = formData.get("file");
  const fileEntries = [...files, ...(legacyFile ? [legacyFile] : [])].filter(
    (entry): entry is File => entry instanceof File
  );

  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (fileEntries.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      {
        error: `Too many files. Max ${MAX_FILES_PER_REQUEST} files per upload.`,
      },
      { status: 400 }
    );
  }

  let totalSize = 0;
  const normalizedEntries: Array<{
    file: File;
    contentType: string;
    fileName: string;
  }> = [];
  for (const [index, file] of fileEntries.entries()) {
    const contentType = resolvePhotoContentType(file);
    if (!contentType) {
      return NextResponse.json(
        { error: "Unsupported format. Use JPG, PNG, or WEBP." },
        { status: 415 }
      );
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Empty file is not allowed." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "One of the files exceeds the maximum size (10MB)." },
        { status: 413 }
      );
    }
    totalSize += file.size;
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Total upload size exceeded (35MB)." },
        { status: 413 }
      );
    }

    normalizedEntries.push({
      file,
      contentType,
      fileName: buildSafePhotoName(index + 1, contentType),
    });
  }

  const checklistRaw = formData.get("checklist");
  let parsedChecklist: unknown = null;
  if (typeof checklistRaw === "string") {
    try {
      parsedChecklist = JSON.parse(checklistRaw);
    } catch {
      return NextResponse.json(
        { error: "Invalid checklist payload" },
        { status: 400 }
      );
    }
  }
  const normalizedChecklist = Array.isArray(parsedChecklist)
    ? parsedChecklist.map((item) => ({
        label: typeof item?.label === "string" ? item.label : undefined,
        completed: Boolean(item?.completed),
      }))
    : Array.isArray(job.checklist)
      ? (job.checklist as Array<{ label?: string; completed?: boolean }>)
      : [];
  const requiresChecklist = normalizedChecklist.length > 0;
  const isCompleting = job.status !== "COMPLETED";
  if (isCompleting && requiresChecklist && typeof checklistRaw !== "string") {
    return NextResponse.json(
      { error: "Checklist is required" },
      { status: 400 }
    );
  }
  if (isCompleting && requiresChecklist) {
    const allComplete = normalizedChecklist.every((item) => item.completed);
    if (!allComplete) {
      return NextResponse.json(
        { error: "Checklist incomplete" },
        { status: 400 }
      );
    }
  }

  const createdPhotos = [];
  for (const entry of normalizedEntries) {
    const arrayBuffer = await entry.file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const url = await storePublicAsset({
      relativePath: buildJobPhotoAssetPath(jobId, entry.fileName),
      buffer,
      contentType: entry.contentType,
      cacheControl: "public, max-age=31536000, immutable",
    });
    const photo = await prisma.jobPhoto.create({
      data: {
        jobId,
        url,
        uploadedByUserId: session.sub,
      },
    });
    createdPhotos.push(photo);
  }

  const completedAt = new Date();
  const internalNotes = formData.get("internalNotes");
  const customerNotes = formData.get("customerNotes");
  const updateData: Record<string, unknown> = {};
  if (isCompleting) {
    updateData.status = "COMPLETED";
    updateData.completedAt = completedAt;
  }
  if (normalizedChecklist.length > 0) {
    updateData.checklist = normalizedChecklist;
  }
  if (typeof internalNotes === "string" && internalNotes.trim()) {
    updateData.notes = internalNotes.trim();
  }
  if (typeof customerNotes === "string" && customerNotes.trim()) {
    updateData.customerNotes = customerNotes.trim();
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });
  }

  if (session.role === "TECH" && isCompleting) {
    await createNotification({
      customerId: job.customerId,
      recipientRole: "ADMIN",
      eventType: "JOB_COMPLETED",
      severity: "INFO",
      actorUserId: session.sub,
      payload: {
        jobId: job.id,
        technicianName: session.name,
        completedAt: completedAt.toISOString(),
      },
    });
  }

  await logAuditEvent({
    userId: session.sub,
    action: isCompleting ? "JOB_COMPLETED_WITH_PHOTOS" : "JOB_PHOTOS_UPLOADED",
    entity: "Job",
    entityId: job.id,
    metadata: {
      customerId: job.customerId,
      uploadedCount: createdPhotos.length,
      checklistSubmitted: typeof checklistRaw === "string",
      completed: isCompleting,
    },
  });

  return NextResponse.json({ ok: true, photos: createdPhotos });
}
