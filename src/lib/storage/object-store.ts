import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type StoreAssetInput = {
  relativePath: string;
  buffer: Buffer;
  contentType?: string;
  cacheControl?: string;
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
    return `/${storagePath}`;
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
