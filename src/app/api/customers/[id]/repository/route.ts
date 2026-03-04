import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getAssetUrl } from "@/lib/assets";
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
  getPublicAssetUrl,
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
        url: getPublicAssetUrl(object.key),
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

async function listInvoiceEntries(customerId: string, currentPath: string) {
  type InvoiceRepositoryObject = StoredAssetItem & {
    originalPath: string | null;
  };

  const invoices = await prisma.invoice.findMany({
    where: {
      customerId,
      pdfUrl: { not: null },
      status: { in: ["SENT", "PAID", "OVERDUE"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      pdfUrl: true,
      createdAt: true,
    },
  });

  const invoiceObjects: InvoiceRepositoryObject[] = invoices
    .filter((invoice) => Boolean(invoice.pdfUrl))
    .map((invoice) => {
      const month = String(invoice.createdAt.getUTCMonth() + 1).padStart(2, "0");
      const year = String(invoice.createdAt.getUTCFullYear());
      const storagePath = toStoragePath(invoice.pdfUrl ?? "");
      const fileName = `${invoice.number}.pdf`;
      return {
        key: `invoices/${year}/${month}/${fileName}`,
        size: null,
        lastModified: invoice.createdAt.toISOString(),
        originalPath: storagePath,
      };
    });

  const visiblePrefix = currentPath === "invoices" ? "invoices/" : `${currentPath}/`;
  const objects = invoiceObjects.filter((item) => item.key.startsWith(visiblePrefix));

  const entries = collectDirectChildrenFromObjects(
    objects,
    visiblePrefix,
    visiblePrefix,
    true
  ).map((entry) => {
    if (entry.type !== "file") {
      return entry;
    }
    const match = invoiceObjects.find((item) => item.key === entry.path);
    const url = match?.originalPath ? getAssetUrl(match.originalPath) : undefined;
    return {
      ...entry,
      url,
    };
  });

  return entries;
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
    );

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
      }
    | null;

  if (!payload?.action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  const rootPrefix = buildCustomerRepositoryRoot(customerId);
  const actionPath = sanitizeRepositoryPath(payload.path ?? "");

  if (!isFilesPath(actionPath)) {
    return NextResponse.json({ error: "Only files tree can be modified" }, { status: 400 });
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
