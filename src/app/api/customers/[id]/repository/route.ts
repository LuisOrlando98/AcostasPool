import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  buildCustomerRepositoryRoot,
  removePrefix,
  sanitizeRepositoryName,
  sanitizeRepositoryPath,
  splitRepositoryParent,
} from "@/lib/customers/repository";
import {
  deleteStoredAsset,
  deleteStoredPrefix,
  listStoredAssets,
  moveStoredAsset,
  storePublicAsset,
  type StoredAssetItem,
} from "@/lib/storage/object-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ExplorerEntry = {
  type: "folder" | "file";
  name: string;
  path: string;
  size: number | null;
  lastModified: string | null;
  url?: string;
  readOnly?: boolean;
  invoiceId?: string;
};

function buildDownloadUrl(customerId: string, path: string, invoiceId?: string) {
  const query = new URLSearchParams();
  query.set("path", path);
  if (invoiceId) {
    query.set("invoiceId", invoiceId);
  }
  return `/api/customers/${customerId}/repository/download?${query.toString()}`;
}

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

function isFilesPath(path: string) {
  return path === "files" || path.startsWith("files/");
}

function isInvoicesPath(path: string) {
  return path === "invoices" || path.startsWith("invoices/");
}

function sortEntries(entries: ExplorerEntry[]) {
  return entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function buildFolderEntry(path: string, name: string, readOnly = false): ExplorerEntry {
  return {
    type: "folder",
    path,
    name,
    size: null,
    lastModified: null,
    readOnly,
  };
}

function collectDirectChildrenFromObjects(
  objects: StoredAssetItem[],
  absolutePrefix: string,
  visiblePrefix: string,
  readOnly = false
) {
  const folders = new Map<string, ExplorerEntry>();
  const files: ExplorerEntry[] = [];

  for (const object of objects) {
    const remainder = removePrefix(object.key, absolutePrefix);
    if (!remainder) {
      continue;
    }
    if (remainder === ".keep") {
      continue;
    }

    const slashIndex = remainder.indexOf("/");
    if (slashIndex === -1) {
      files.push({
        type: "file",
        name: remainder,
        path: `${visiblePrefix}${remainder}`,
        size: object.size,
        lastModified: object.lastModified,
        readOnly,
      });
      continue;
    }

    const folderName = remainder.slice(0, slashIndex);
    if (!folders.has(folderName)) {
      folders.set(
        folderName,
        buildFolderEntry(`${visiblePrefix}${folderName}`, folderName, readOnly)
      );
    }
  }

  return sortEntries([...folders.values(), ...files]);
}

function computeParentPath(path: string) {
  if (!path) {
    return null;
  }
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

const INVOICE_NUMBER_PATTERN = /[^a-zA-Z0-9-_]/g;

function sanitizeInvoiceNumber(value: string, fallback: string) {
  const normalized = value.trim().replace(INVOICE_NUMBER_PATTERN, "_");
  return normalized || fallback;
}

async function listInvoiceEntries(customerId: string, currentPath: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      customerId,
      pdfUrl: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      createdAt: true,
    },
  });

  const usedPaths = new Set<string>();
  const invoiceRecords = invoices.map((invoice) => {
    const month = String(invoice.createdAt.getUTCMonth() + 1).padStart(2, "0");
    const year = String(invoice.createdAt.getUTCFullYear());
    const safeNumber = sanitizeInvoiceNumber(invoice.number, `invoice-${invoice.id.slice(0, 8)}`);
    let fileName = `${safeNumber}.pdf`;
    let path = `invoices/${year}/${month}/${fileName}`;
    if (usedPaths.has(path)) {
      fileName = `${safeNumber}-${invoice.id.slice(0, 6)}.pdf`;
      path = `invoices/${year}/${month}/${fileName}`;
    }
    usedPaths.add(path);
    return {
      invoiceId: invoice.id,
      createdAt: invoice.createdAt,
      year,
      month,
      fileName,
      path,
    };
  });

  if (currentPath === "invoices") {
    const years = Array.from(new Set(invoiceRecords.map((item) => item.year))).sort(
      (a, b) => Number(b) - Number(a)
    );
    return years.map((year) =>
      buildFolderEntry(`invoices/${year}`, year, false)
    );
  }

  const yearMatch = /^invoices\/(\d{4})$/.exec(currentPath);
  if (yearMatch) {
    const year = yearMatch[1];
    const months = Array.from(
      new Set(
        invoiceRecords
          .filter((item) => item.year === year)
          .map((item) => item.month)
      )
    ).sort((a, b) => Number(b) - Number(a));
    return months.map((month) =>
      buildFolderEntry(`invoices/${year}/${month}`, month, false)
    );
  }

  const monthMatch = /^invoices\/(\d{4})\/(\d{2})$/.exec(currentPath);
  if (monthMatch) {
    const [, year, month] = monthMatch;
    return invoiceRecords
      .filter((item) => item.year === year && item.month === month)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(
        (item): ExplorerEntry => ({
          type: "file",
          name: item.fileName,
          path: item.path,
          size: null,
          lastModified: item.createdAt.toISOString(),
          url: buildDownloadUrl(customerId, item.path, item.invoiceId),
          readOnly: false,
          invoiceId: item.invoiceId,
        })
      );
  }

  return [];
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
  const currentPath = sanitizeRepositoryPath(searchParams.get("path"));
  const rootPrefix = buildCustomerRepositoryRoot(customerId);
  const safePath = currentPath || "";

  if (!safePath) {
    return NextResponse.json({
      currentPath: "",
      parentPath: null,
      entries: sortEntries([
        buildFolderEntry("invoices", "Invoices", true),
        buildFolderEntry("files", "Files"),
      ]),
    });
  }

  if (isInvoicesPath(safePath)) {
    const entries = await listInvoiceEntries(customerId, safePath);
    return NextResponse.json({
      currentPath: safePath,
      parentPath: computeParentPath(safePath),
      entries,
    });
  }

  if (isFilesPath(safePath)) {
    const filesSubPath = safePath === "files" ? "" : safePath.slice("files/".length);
    const absolutePrefix = `${rootPrefix}${filesSubPath ? `${filesSubPath}/` : ""}`;
    const objects = await listStoredAssets(absolutePrefix);
    const visiblePrefix = safePath === "files" ? "files/" : `${safePath}/`;
    const entries = collectDirectChildrenFromObjects(
      objects,
      absolutePrefix,
      visiblePrefix,
      false
    ).map((entry): ExplorerEntry => {
      if (entry.type !== "file") {
        return entry;
      }
      return {
        ...entry,
        url: buildDownloadUrl(customerId, entry.path),
      };
    });

    return NextResponse.json({
      currentPath: safePath,
      parentPath: computeParentPath(safePath),
      entries,
    });
  }

  return NextResponse.json({ error: "Invalid repository path" }, { status: 400 });
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

  const payload = (await request.json().catch(() => null)) as
    | {
        action?: string;
        path?: string;
        type?: "folder" | "file";
        name?: string;
        newName?: string;
        invoiceId?: string;
      }
    | null;

  if (!payload?.action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  const rootPrefix = buildCustomerRepositoryRoot(customerId);
  const actionPath = sanitizeRepositoryPath(payload.path ?? "");

  const isFileTreeAction = isFilesPath(actionPath);
  const isInvoiceTreeAction = isInvoicesPath(actionPath);

  if (!isFileTreeAction && !isInvoiceTreeAction) {
    return NextResponse.json(
      { error: "Only files and invoices trees can be modified" },
      { status: 400 }
    );
  }

  if (payload.action === "delete" && isInvoiceTreeAction) {
    const entryType = payload.type === "folder" ? "folder" : "file";
    if (entryType !== "file") {
      return NextResponse.json(
        { error: "Only invoice files can be deleted" },
        { status: 400 }
      );
    }

    const invoiceId =
      typeof payload.invoiceId === "string" ? payload.invoiceId.trim() : "";

    const invoice = invoiceId
      ? await prisma.invoice.findFirst({
          where: { id: invoiceId, customerId },
          select: { id: true, pdfUrl: true },
        })
      : null;

    const fallbackInvoice = !invoice
      ? await (async () => {
          const fileName = actionPath.split("/").pop() ?? "";
          if (!fileName.toLowerCase().endsWith(".pdf")) {
            return null;
          }
          const invoiceNumber = fileName.slice(0, -4);
          if (!invoiceNumber) {
            return null;
          }
          return prisma.invoice.findFirst({
            where: { customerId, number: invoiceNumber },
            select: { id: true, pdfUrl: true },
          });
        })()
      : null;

    const resolvedInvoice = invoice ?? fallbackInvoice;

    if (!resolvedInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const storagePath = toStoragePath(resolvedInvoice.pdfUrl ?? "");
    if (storagePath) {
      await deleteStoredAsset(storagePath);
    }

    await prisma.invoice.delete({
      where: { id: resolvedInvoice.id },
    });
    return NextResponse.json({ ok: true });
  }

  if (!isFileTreeAction) {
    return NextResponse.json({ error: "Only files tree supports this action" }, { status: 400 });
  }

  if (payload.action === "createFolder") {
    const parentSubPath = actionPath === "files" ? "" : actionPath.slice("files/".length);
    const folderName = sanitizeRepositoryName(payload.name ?? "folder", "folder");
    const markerPath = `${rootPrefix}${parentSubPath ? `${parentSubPath}/` : ""}${folderName}/.keep`;
    await storePublicAsset({
      relativePath: markerPath,
      buffer: Buffer.from(""),
      contentType: "text/plain",
      cacheControl: "no-cache",
    });
    return NextResponse.json({ ok: true });
  }

  const type = payload.type === "folder" ? "folder" : "file";
  const sourceSubPath = actionPath === "files" ? "" : actionPath.slice("files/".length);
  if (!sourceSubPath) {
    return NextResponse.json({ error: "Root folder cannot be modified" }, { status: 400 });
  }

  if (payload.action === "delete") {
    if (type === "folder") {
      await deleteStoredPrefix(`${rootPrefix}${sourceSubPath}/`);
      return NextResponse.json({ ok: true });
    }
    await deleteStoredAsset(`${rootPrefix}${sourceSubPath}`);
    return NextResponse.json({ ok: true });
  }

  if (payload.action === "rename") {
    const nextName = sanitizeRepositoryName(payload.newName ?? "", "item");
    const { parent } = splitRepositoryParent(sourceSubPath);
    const targetSubPath = parent ? `${parent}/${nextName}` : nextName;
    if (targetSubPath === sourceSubPath) {
      return NextResponse.json({ ok: true });
    }

    if (type === "file") {
      await moveStoredAsset(
        `${rootPrefix}${sourceSubPath}`,
        `${rootPrefix}${targetSubPath}`
      );
      return NextResponse.json({ ok: true });
    }

    const sourcePrefix = `${rootPrefix}${sourceSubPath}/`;
    const targetPrefix = `${rootPrefix}${targetSubPath}/`;
    const objects = await listStoredAssets(sourcePrefix);
    if (objects.length === 0) {
      await storePublicAsset({
        relativePath: `${targetPrefix}.keep`,
        buffer: Buffer.from(""),
        contentType: "text/plain",
        cacheControl: "no-cache",
      });
      await deleteStoredPrefix(sourcePrefix);
      return NextResponse.json({ ok: true });
    }

    for (const object of objects) {
      const remainder = removePrefix(object.key, sourcePrefix);
      if (remainder == null) {
        continue;
      }
      const targetPath = `${targetPrefix}${remainder}`;
      await moveStoredAsset(object.key, targetPath);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
