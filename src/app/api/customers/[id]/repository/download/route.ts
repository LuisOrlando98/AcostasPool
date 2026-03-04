import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { buildCustomerRepositoryRoot, sanitizeRepositoryPath } from "@/lib/customers/repository";
import { readStoredAsset } from "@/lib/storage/object-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function toStoragePath(raw: string) {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const parsed = new URL(value);
      return parsed.pathname.replace(/^\/+/, "");
    } catch {
      return null;
    }
  }
  return value.replace(/^\/+/, "");
}

function isFilesPath(value: string) {
  return value === "files" || value.startsWith("files/");
}

function isInvoicesPath(value: string) {
  return value === "invoices" || value.startsWith("invoices/");
}

function contentTypeFromFileName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".csv") return "text/csv";
  if (extension === ".txt" || extension === ".log") return "text/plain; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".zip") return "application/zip";
  return "application/octet-stream";
}

export async function GET(request: Request, context: RouteContext) {
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

  const { searchParams } = new URL(request.url);
  const safePath = sanitizeRepositoryPath(searchParams.get("path"));
  if (!safePath) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  try {
    if (isInvoicesPath(safePath)) {
      const fileName = safePath.split("/").pop() ?? "";
      if (!fileName.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ error: "Invalid invoice file" }, { status: 400 });
      }

      const invoiceNumber = fileName.slice(0, -4);
      const invoice = await prisma.invoice.findFirst({
        where: {
          customerId,
          number: invoiceNumber,
          pdfUrl: { not: null },
        },
        select: {
          number: true,
          pdfUrl: true,
        },
      });
      if (!invoice?.pdfUrl) {
        return NextResponse.json({ error: "Invoice file not found" }, { status: 404 });
      }

      const storagePath = toStoragePath(invoice.pdfUrl);
      if (!storagePath) {
        return NextResponse.json({ error: "Invoice file not found" }, { status: 404 });
      }

      const buffer = await readStoredAsset(storagePath);
      const downloadName = `${invoice.number}.pdf`;
      return new NextResponse(buffer, {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${downloadName}"`,
          "cache-control": "no-store",
        },
      });
    }

    if (isFilesPath(safePath)) {
      const sourceSubPath = safePath === "files" ? "" : safePath.slice("files/".length);
      if (!sourceSubPath) {
        return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
      }

      const rootPrefix = buildCustomerRepositoryRoot(customerId);
      const storagePath = `${rootPrefix}${sourceSubPath}`;
      const buffer = await readStoredAsset(storagePath);
      const downloadName = sourceSubPath.split("/").pop() ?? "download.bin";
      return new NextResponse(buffer, {
        headers: {
          "content-type": contentTypeFromFileName(downloadName),
          "content-disposition": `attachment; filename="${downloadName}"`,
          "cache-control": "no-store",
        },
      });
    }

    return NextResponse.json({ error: "Invalid repository path" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
