import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/create";
import { storePublicAsset } from "@/lib/storage/object-store";
import { buildJobPhotoAssetPath } from "@/lib/storage/paths";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
  const fileEntries = [
    ...files,
    ...(legacyFile ? [legacyFile] : []),
  ].filter((entry): entry is File => entry instanceof File);

  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
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
  for (const file of fileEntries) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const url = await storePublicAsset({
      relativePath: buildJobPhotoAssetPath(jobId, file.name),
      buffer,
      contentType: file.type || undefined,
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

  return NextResponse.json({ ok: true, photos: createdPhotos });
}
