import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {},
  PutObjectCommand: class {},
  GetObjectCommand: class {},
  ListObjectsV2Command: class {},
  DeleteObjectCommand: class {},
  CopyObjectCommand: class {},
}));

type ObjectStoreModule = typeof import("@/lib/storage/object-store");

const S3_ENV_KEYS = [
  "STORAGE_DRIVER",
  "AWS_S3_BUCKET",
  "AWS_REGION",
  "NEXT_PUBLIC_CDN_URL",
] as const;

/**
 * The driver and bucket are read from process.env at module load, so every
 * scenario re-imports the module with a fresh environment.
 */
async function loadObjectStore(
  env: Partial<Record<(typeof S3_ENV_KEYS)[number], string>>
): Promise<ObjectStoreModule> {
  vi.resetModules();
  for (const key of S3_ENV_KEYS) {
    vi.stubEnv(key, env[key] ?? "");
  }
  return import("@/lib/storage/object-store");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPublicAssetUrl (local driver) - normalizeStoragePath", () => {
  it("prefixes a clean relative path with a slash", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({ STORAGE_DRIVER: "local" });
    expect(getPublicAssetUrl("uploads/a.png")).toBe("/uploads/a.png");
  });

  it("defaults to the local driver when STORAGE_DRIVER is unset", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({});
    expect(getPublicAssetUrl("uploads/a.png")).toBe("/uploads/a.png");
  });

  it("collapses leading slashes and trims whitespace", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({ STORAGE_DRIVER: "local" });
    expect(getPublicAssetUrl("  ///uploads/a.png  ")).toBe("/uploads/a.png");
  });

  it("converts backslashes to forward slashes", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({ STORAGE_DRIVER: "local" });
    expect(getPublicAssetUrl("uploads\\jobs\\a.png")).toBe("/uploads/jobs/a.png");
  });

  it("extracts the pathname from absolute http(s) URLs", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({ STORAGE_DRIVER: "local" });
    expect(
      getPublicAssetUrl("https://cdn.example.com/uploads/x.png?v=1#frag")
    ).toBe("/uploads/x.png");
    expect(getPublicAssetUrl("http://host/uploads/y.png")).toBe("/uploads/y.png");
  });

  it("throws when the path is empty or whitespace", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({ STORAGE_DRIVER: "local" });
    expect(() => getPublicAssetUrl("")).toThrow("Storage path is required");
    expect(() => getPublicAssetUrl("   ")).toThrow("Storage path is required");
  });

  it("throws when the path becomes empty after normalization", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({ STORAGE_DRIVER: "local" });
    expect(() => getPublicAssetUrl("/")).toThrow("Invalid storage path");
    expect(() => getPublicAssetUrl("https://host/")).toThrow("Invalid storage path");
  });

  it("rejects path traversal with '..'", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({ STORAGE_DRIVER: "local" });
    expect(() => getPublicAssetUrl("../etc/passwd")).toThrow("Invalid storage path");
    expect(() => getPublicAssetUrl("uploads/../x")).toThrow("Invalid storage path");
    expect(() => getPublicAssetUrl("uploads/..")).toThrow("Invalid storage path");
  });

  it("lets the URL parser resolve dot segments in absolute URLs before the guard", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({ STORAGE_DRIVER: "local" });
    expect(getPublicAssetUrl("https://host/a/../b")).toBe("/b");
  });

  it.fails(
    "accepts a file name that merely contains '..' (currently rejected)",
    async () => {
      // includes("..") rejects any dotted-dotted substring, so a valid upload
      // named "my..photo.png" cannot be stored or resolved.
      const { getPublicAssetUrl } = await loadObjectStore({ STORAGE_DRIVER: "local" });
      expect(getPublicAssetUrl("uploads/my..photo.png")).toBe(
        "/uploads/my..photo.png"
      );
    }
  );

  it("strips the bucket name prefix when AWS_S3_BUCKET is configured", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({
      STORAGE_DRIVER: "local",
      AWS_S3_BUCKET: "my-bucket",
    });
    expect(getPublicAssetUrl("my-bucket/uploads/x.png")).toBe("/uploads/x.png");
    expect(getPublicAssetUrl("https://s3.amazonaws.com/my-bucket/uploads/x.png")).toBe(
      "/uploads/x.png"
    );
  });

  it("does not strip the bucket name when it is not followed by a slash", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({
      STORAGE_DRIVER: "local",
      AWS_S3_BUCKET: "my-bucket",
    });
    expect(getPublicAssetUrl("my-bucket-old/x.png")).toBe("/my-bucket-old/x.png");
    expect(getPublicAssetUrl("my-bucket")).toBe("/my-bucket");
  });

  it("throws when the path only contains the bucket prefix", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({
      STORAGE_DRIVER: "local",
      AWS_S3_BUCKET: "my-bucket",
    });
    expect(() => getPublicAssetUrl("my-bucket/")).toThrow("Invalid storage path");
  });
});

describe("getPublicAssetUrl (s3 driver) - public URL helpers", () => {
  it("joins the CDN base and the key without duplicate slashes", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({
      STORAGE_DRIVER: "s3",
      NEXT_PUBLIC_CDN_URL: "https://cdn.example.com/",
    });
    expect(getPublicAssetUrl("/uploads/x.png")).toBe(
      "https://cdn.example.com/uploads/x.png"
    );
  });

  it("builds the virtual-hosted S3 URL when no CDN is configured", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({
      STORAGE_DRIVER: "S3",
      AWS_S3_BUCKET: "my-bucket",
      AWS_REGION: "us-east-1",
    });
    expect(getPublicAssetUrl("uploads/x.png")).toBe(
      "https://my-bucket.s3.us-east-1.amazonaws.com/uploads/x.png"
    );
  });

  it("throws naming the missing environment variable", async () => {
    const withoutBucket = await loadObjectStore({ STORAGE_DRIVER: "s3" });
    expect(() => withoutBucket.getPublicAssetUrl("uploads/x.png")).toThrow(
      "AWS_S3_BUCKET is not set"
    );

    const withoutRegion = await loadObjectStore({
      STORAGE_DRIVER: "s3",
      AWS_S3_BUCKET: "b",
    });
    expect(() => withoutRegion.getPublicAssetUrl("uploads/x.png")).toThrow(
      "AWS_REGION is not set"
    );
  });

  it("ignores a whitespace-only CDN url", async () => {
    const { getPublicAssetUrl } = await loadObjectStore({
      STORAGE_DRIVER: "s3",
      NEXT_PUBLIC_CDN_URL: "   ",
      AWS_S3_BUCKET: "b",
      AWS_REGION: "eu-west-1",
    });
    expect(getPublicAssetUrl("k.png")).toBe("https://b.s3.eu-west-1.amazonaws.com/k.png");
  });
});
