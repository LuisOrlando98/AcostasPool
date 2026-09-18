import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { copyFile, mkdir, readFile, rename, rm, unlink, writeFile } from "fs/promises";
import path from "path";
import { normalizeStorageKey } from "@/lib/storage/asset-keys";
import {
  findExistingLocalPath,
  listLocalFiles,
  localPathExists,
  resolveLocalCandidates,
  resolveLocalWritePath,
} from "@/lib/storage/local-fs";
import { presignS3GetUrl } from "@/lib/storage/s3-presign";

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

/**
 * Cache-Control con el que se guardan los recursos con control de acceso. Los
 * sirve `/api/files` tras autorizar, así que ni el navegador ni el CDN deben
 * quedarse con una copia reutilizable.
 */
export const PRIVATE_ASSET_CACHE_CONTROL = "private, no-store";

export type PresignStoredAssetInput = {
  expiresInSeconds: number;
  contentType?: string;
  contentDisposition?: string;
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

const normalizeStoragePath = (value: string) => normalizeStorageKey(value);

/** true cuando el almacenamiento vigente es S3 (y por tanto se firman URLs). */
export function isS3StorageDriver() {
  return isS3Storage;
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

  const outputPath = resolveLocalWritePath(storagePath);
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

  const absolute = await findExistingLocalPath(storagePath);
  if (!absolute) {
    throw new Error(`Stored asset ${storagePath} not found`);
  }
  return readFile(absolute);
}

/** Ruta absoluta en disco de un recurso local, o null si no existe en ninguna raíz. */
export async function findLocalAssetPath(relativePath: string) {
  const storagePath = normalizeStoragePath(relativePath);
  return findExistingLocalPath(storagePath);
}

/**
 * URL prefirmada de corta duración para el driver s3. El bucket puede (y debe)
 * quedar privado: nadie descarga sin pasar antes por `/api/files`.
 */
export function presignStoredAsset(
  relativePath: string,
  { expiresInSeconds, contentType, contentDisposition }: PresignStoredAssetInput
) {
  const storagePath = normalizeStoragePath(relativePath);
  return presignS3GetUrl({
    bucket: getS3Bucket(),
    region: getRequiredEnv("AWS_REGION"),
    key: storagePath,
    accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
    sessionToken: process.env.AWS_SESSION_TOKEN?.trim() || null,
    expiresInSeconds,
    responseContentType: contentType ?? null,
    responseContentDisposition: contentDisposition ?? null,
  });
}

export async function listStoredAssets(prefixPath: string): Promise<StoredAssetItem[]> {
  const normalizedPrefix = normalizeStoragePath(prefixPath)
    .replace(/\/+$/, "")
    .concat("/");

  if (isS3Storage) {
    const allItems: StoredAssetItem[] = [];
    let continuationToken: string | undefined = undefined;

    do {
      const response: ListObjectsV2CommandOutput = await getS3Client().send(
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

  return listLocalFiles(normalizedPrefix);
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

  // Se borra en las dos raíces: el archivo puede ser histórico (public/) o nuevo.
  const candidates = resolveLocalCandidates(storagePath);
  await Promise.all(
    candidates.map(async (absolute) => {
      if (await localPathExists(absolute)) {
        await unlink(absolute);
      }
    })
  );
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

  const sourceAbsolute = await findExistingLocalPath(sourceKey);
  if (!sourceAbsolute) {
    throw new Error(`Stored asset ${sourceKey} not found`);
  }
  const targetAbsolute = resolveLocalWritePath(targetKey);
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

  const sourceAbsolute = await findExistingLocalPath(sourceKey);
  if (!sourceAbsolute) {
    throw new Error(`Stored asset ${sourceKey} not found`);
  }
  const targetAbsolute = resolveLocalWritePath(targetKey);
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
    const candidates = resolveLocalCandidates(normalizedPrefix);
    await Promise.all(
      candidates.map(async (absolute) => {
        if (await localPathExists(absolute)) {
          await rm(absolute, { recursive: true, force: true });
        }
      })
    );
  }
}
