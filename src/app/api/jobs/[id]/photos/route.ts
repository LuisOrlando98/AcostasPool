import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/create";
import { logAuditEvent } from "@/lib/audit/log";
import { storePublicAsset } from "@/lib/storage/object-store";
import {
  escapeHtml,
  renderEmailTemplate,
  resolveEmailTemplateLocale,
} from "@/lib/email-templates";
import { getEmailTemplatesConfig } from "@/lib/site-settings";
import sharp from "sharp";
import {
  buildCustomerJobPhotoAssetPath,
  buildTechJobPhotoFileName,
} from "@/lib/storage/paths";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

export const runtime = "nodejs";

const SUPPORTED_MIME_TYPES: Record<string, true> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
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
  if (SUPPORTED_MIME_TYPES[mime]) {
    return mime;
  }
  const ext = getFileExtension(file.name);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

function formatDateTimeLabel(date: Date, locale: "EN" | "ES") {
  return new Intl.DateTimeFormat(locale === "ES" ? "es-US" : "en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function sendCompletedJobEmailNow(input: {
  notificationId: string;
  customerId: string;
  jobId: string;
  customerEmail: string;
  customerName: string;
  technicianName: string;
  completedAt: Date;
  propertyAddress: string;
  customerLocale: "EN" | "ES";
}) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return false;
  }

  const templates = await getEmailTemplatesConfig(
    resolveEmailTemplateLocale(input.customerLocale)
  );
  const completedLabel = formatDateTimeLabel(
    input.completedAt,
    resolveEmailTemplateLocale(input.customerLocale)
  );
  const rendered = renderEmailTemplate(templates.CUSTOMER_JOB_COMPLETED, {
    customer_name: input.customerName,
    customer_name_html: escapeHtml(input.customerName),
    technician_name: input.technicianName,
    technician_name_html: escapeHtml(input.technicianName),
    completed_label: completedLabel,
    completed_label_html: escapeHtml(completedLabel),
    job_address: input.propertyAddress,
    job_address_html: escapeHtml(input.propertyAddress),
  });

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: input.customerEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    await prisma.emailLog.create({
      data: {
        recipientEmail: input.customerEmail,
        recipientName: input.customerName,
        recipientRole: "CUSTOMER",
        subject: rendered.subject,
        bodyText: rendered.text,
        bodyHtml: rendered.html,
        status: "SENT",
        sentAt: new Date(),
        customerId: input.customerId,
        jobId: input.jobId,
        metadata: {
          notificationId: input.notificationId,
          eventType: "JOB_COMPLETED",
          immediate: true,
        },
      },
    });

    return true;
  } catch (error) {
    await prisma.emailLog.create({
      data: {
        recipientEmail: input.customerEmail,
        recipientName: input.customerName,
        recipientRole: "CUSTOMER",
        subject: rendered.subject,
        bodyText: rendered.text,
        bodyHtml: rendered.html,
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        customerId: input.customerId,
        jobId: input.jobId,
        metadata: {
          notificationId: input.notificationId,
          eventType: "JOB_COMPLETED",
          immediate: true,
        },
      },
    });

    return false;
  }
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
    include: {
      technician: { include: { user: true } },
      customer: {
        select: {
          nombre: true,
          apellidos: true,
          email: true,
          idiomaPreferencia: true,
        },
      },
      property: { select: { address: true } },
      photos: { select: { id: true } },
    },
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
  const normalizedEntries: Array<{ file: File }> = [];
  for (const file of fileEntries) {
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
  const customerName = `${job.customer.nombre ?? ""} ${job.customer.apellidos ?? ""}`.trim();
  const technicianName =
    job.technician?.user?.fullName ||
    session.name ||
    "Tech";
  const existingPhotosCount = job.photos.length;
  const now = new Date();

  for (const [index, entry] of normalizedEntries.entries()) {
    const arrayBuffer = await entry.file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);
    const jpegBuffer = await sharp(originalBuffer)
      .rotate()
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer()
      .catch(() => null);
    if (!jpegBuffer) {
      return NextResponse.json(
        { error: "Unable to process one of the images." },
        { status: 400 }
      );
    }
    const fileName = buildTechJobPhotoFileName({
      date: now,
      customerName,
      technicianName,
      index: existingPhotosCount + index,
    });
    const url = await storePublicAsset({
      relativePath: buildCustomerJobPhotoAssetPath(job.customerId, fileName, now),
      buffer: jpegBuffer,
      contentType: "image/jpeg",
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

  if (isCompleting) {
    const customerNotification = await createNotification({
      customerId: job.customerId,
      recipientRole: "CUSTOMER",
      eventType: "JOB_COMPLETED",
      severity: "INFO",
      actorUserId: session.sub,
      payload: {
        jobId: job.id,
        technicianName,
        completedAt: completedAt.toISOString(),
        scheduledDate: job.scheduledDate.toISOString(),
      },
    });

    const customerEmail = job.customer.email?.trim() ?? "";
    if (customerEmail) {
      const sentNow = await sendCompletedJobEmailNow({
        notificationId: customerNotification.id,
        customerId: job.customerId,
        jobId: job.id,
        customerEmail,
        customerName: customerName || "Customer",
        technicianName,
        completedAt,
        propertyAddress: job.property.address || "Address not available",
        customerLocale: job.customer.idiomaPreferencia,
      });

      if (sentNow) {
        await prisma.notification.update({
          where: { id: customerNotification.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });
      }
    }
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
