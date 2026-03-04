import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from "fs/promises";
import path from "path";

type StoreAssetInput = {
  relativePath: string;
  buffer: Buffer;
  contentType?: string;
  cacheControl?: string;
};

export type StoredAssetItem = {
  key: string;
  size: number | null;
  lastModified: string | null;
};

const STORAGE_DRIVER = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
const isS3Storage = STORAGE_DRIVER === "s3";

let s3Client: S3Client | null = null;

const getRequiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

const getS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: getRequiredEnv("AWS_REGION"),
      credentials: {
        accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
      },
    });
  }
  return s3Client;
};

const getS3Bucket = () => getRequiredEnv("AWS_S3_BUCKET");

const joinUrl = (base: string, key: string) => {
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const trimmedKey = key.startsWith("/") ? key.slice(1) : key;
  return `${trimmedBase}/${trimmedKey}`;
};

const getS3PublicUrl = (storagePath: string) => {
  const cdnBase = process.env.NEXT_PUBLIC_CDN_URL?.trim();
  if (cdnBase) {
    return joinUrl(cdnBase, storagePath);
  }
  const bucket = getS3Bucket();
  const region = getRequiredEnv("AWS_REGION");
  return `https://${bucket}.s3.${region}.amazonaws.com/${storagePath}`;
};

const normalizeStoragePath = (value: string) => {
  let normalized = value.trim();
  if (!normalized) {
    throw new Error("Storage path is required");
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    const parsed = new URL(normalized);
    normalized = parsed.pathname;
  }

  normalized = normalized.replace(/\\/g, "/").replace(/^\/+/, "");

  const bucket = process.env.AWS_S3_BUCKET;
  if (bucket && normalized.startsWith(`${bucket}/`)) {
    normalized = normalized.slice(bucket.length + 1);
  }

  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid storage path");
  }
  return normalized;
};

const resolveLocalPath = (storagePath: string) =>
  path.join(process.cwd(), "public", ...storagePath.split("/"));

const localPathExists = async (absolutePath: string) => {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
};

async function walkLocalFiles(
  rootPath: string,
  rootStoragePrefix: string
): Promise<StoredAssetItem[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const items: StoredAssetItem[] = [];

  for (const entry of entries) {
    const absolute = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      const nestedPrefix = `${rootStoragePrefix}${entry.name}/`;
      const nested = await walkLocalFiles(absolute, nestedPrefix);
      items.push(...nested);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const info = await stat(absolute);
    items.push({
      key: `${rootStoragePrefix}${entry.name}`,
      size: Number.isFinite(info.size) ? info.size : null,
      lastModified: info.mtime ? info.mtime.toISOString() : null,
    });
  }

  return items;
}

export function getPublicAssetUrl(relativePath: string) {
  const storagePath = normalizeStoragePath(relativePath);
  if (isS3Storage) {
    return getS3PublicUrl(storagePath);
  }
  return `/${storagePath}`;
}

export async function storePublicAsset({
  relativePath,
  buffer,
  contentType,
  cacheControl,
}: StoreAssetInput) {
  const storagePath = normalizeStoragePath(relativePath);

  if (isS3Storage) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
        Key: storagePath,
        Body: buffer,
        ContentType: contentType,
        CacheControl: cacheControl,
      })
    );
    return getS3PublicUrl(storagePath);
  }

  const outputPath = resolveLocalPath(storagePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  return `/${storagePath}`;
}

export async function readStoredAsset(relativePath: string) {
  const storagePath = normalizeStoragePath(relativePath);

  if (isS3Storage) {
    const response = await getS3Client().send(
      new GetObjectCommand({
        Bucket: getS3Bucket(),
        Key: storagePath,
      })
    );
    if (!response.Body) {
      throw new Error(`S3 object ${storagePath} has no body`);
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  return readFile(resolveLocalPath(storagePath));
}

export async function listStoredAssets(prefixPath: string): Promise<StoredAssetItem[]> {
  const normalizedPrefix = normalizeStoragePath(prefixPath)
    .replace(/\/+$/, "")
    .concat("/");

  if (isS3Storage) {
    const allItems: StoredAssetItem[] = [];
    let continuationToken: string | undefined = undefined;

    do {
      const response = await getS3Client().send(
        new ListObjectsV2Command({
          Bucket: getS3Bucket(),
          Prefix: normalizedPrefix,
          ContinuationToken: continuationToken,
        })
      );

      const pageItems =
        response.Contents?.map((item) => ({
          key: item.Key ?? "",
          size: typeof item.Size === "number" ? item.Size : null,
          lastModified: item.LastModified
            ? item.LastModified.toISOString()
            : null,
        })).filter((item) => Boolean(item.key)) ?? [];

      allItems.push(...pageItems);
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return allItems;
  }

  const rootAbsolute = resolveLocalPath(normalizedPrefix);
  const exists = await localPathExists(rootAbsolute);
  if (!exists) {
    return [];
  }
  return walkLocalFiles(rootAbsolute, normalizedPrefix);
}

export async function deleteStoredAsset(relativePath: string) {
  const storagePath = normalizeStoragePath(relativePath);

  if (isS3Storage) {
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: getS3Bucket(),
        Key: storagePath,
      })
    );
    return;
  }

  const absolute = resolveLocalPath(storagePath);
  const exists = await localPathExists(absolute);
  if (!exists) {
    return;
  }
  await unlink(absolute);
}

export async function copyStoredAsset(sourcePath: string, targetPath: string) {
  const sourceKey = normalizeStoragePath(sourcePath);
  const targetKey = normalizeStoragePath(targetPath);

  if (isS3Storage) {
    const bucket = getS3Bucket();
    await getS3Client().send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${sourceKey}`,
        Key: targetKey,
      })
    );
    return;
  }

  const sourceAbsolute = resolveLocalPath(sourceKey);
  const targetAbsolute = resolveLocalPath(targetKey);
  await mkdir(path.dirname(targetAbsolute), { recursive: true });
  await copyFile(sourceAbsolute, targetAbsolute);
}

export async function moveStoredAsset(sourcePath: string, targetPath: string) {
  const sourceKey = normalizeStoragePath(sourcePath);
  const targetKey = normalizeStoragePath(targetPath);

  if (isS3Storage) {
    await copyStoredAsset(sourceKey, targetKey);
    await deleteStoredAsset(sourceKey);
    return;
  }

  const sourceAbsolute = resolveLocalPath(sourceKey);
  const targetAbsolute = resolveLocalPath(targetKey);
  await mkdir(path.dirname(targetAbsolute), { recursive: true });
  await rename(sourceAbsolute, targetAbsolute);
}

export async function deleteStoredPrefix(prefixPath: string) {
  const normalizedPrefix = normalizeStoragePath(prefixPath)
    .replace(/\/+$/, "")
    .concat("/");
  const files = await listStoredAssets(normalizedPrefix);
  await Promise.all(files.map((item) => deleteStoredAsset(item.key)));

  if (!isS3Storage) {
    const absolute = resolveLocalPath(normalizedPrefix);
    const exists = await localPathExists(absolute);
    if (exists) {
      await rm(absolute, { recursive: true, force: true });
    }
  }
}
