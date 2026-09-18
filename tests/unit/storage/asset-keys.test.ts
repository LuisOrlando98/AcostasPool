import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAssetApiPath,
  classifyAssetKey,
  getAssetFileName,
  isPrivateAssetKey,
  normalizeStorageKey,
  toStorageKey,
} from "@/lib/storage/asset-keys";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeStorageKey", () => {
  it("returns the bare key for a relative path", () => {
    expect(normalizeStorageKey("/invoices/2026/09/c1/INV-1.pdf")).toBe(
      "invoices/2026/09/c1/INV-1.pdf"
    );
  });

  it("extracts the key from a virtual-hosted S3 url", () => {
    expect(
      normalizeStorageKey("https://bucket.s3.us-east-1.amazonaws.com/invoices/2026/09/c1/INV-1.pdf")
    ).toBe("invoices/2026/09/c1/INV-1.pdf");
  });

  it("extracts the key from a CDN url", () => {
    expect(normalizeStorageKey("https://cdn.example.com/uploads/customers/c1/documents/2026/09/f.pdf")).toBe(
      "uploads/customers/c1/documents/2026/09/f.pdf"
    );
  });

  it("strips the bucket prefix from a path-style S3 url", () => {
    vi.stubEnv("AWS_S3_BUCKET", "my-bucket");
    expect(normalizeStorageKey("https://s3.amazonaws.com/my-bucket/invoices/a.pdf")).toBe(
      "invoices/a.pdf"
    );
  });

  it("rejects traversal segments", () => {
    expect(() => normalizeStorageKey("uploads/../etc/passwd")).toThrow("Invalid storage path");
    expect(() => normalizeStorageKey("../secrets")).toThrow("Invalid storage path");
  });

  it("throws when the value is blank", () => {
    expect(() => normalizeStorageKey("   ")).toThrow("Storage path is required");
  });
});

describe("toStorageKey", () => {
  it("returns null instead of throwing for unusable values", () => {
    expect(toStorageKey(null)).toBeNull();
    expect(toStorageKey("")).toBeNull();
    expect(toStorageKey("uploads/../x")).toBeNull();
  });
});

describe("classifyAssetKey", () => {
  it("classifies invoices and reads the customer from the path", () => {
    const info = classifyAssetKey("invoices/2026/09/cust-1/INV-9.pdf");
    expect(info.resource).toBe("invoice");
    expect(info.customerId).toBe("cust-1");
  });

  it("leaves the customer null for an invoice path of unexpected depth", () => {
    expect(classifyAssetKey("invoices/INV-9.pdf").customerId).toBeNull();
  });

  it("classifies avatars", () => {
    expect(classifyAssetKey("avatars/admin/jane-1.jpg").resource).toBe("avatar");
  });

  it("classifies customer documents", () => {
    const info = classifyAssetKey("uploads/customers/cust-1/documents/2026/09/file.pdf");
    expect(info.resource).toBe("customer-document");
    expect(info.customerId).toBe("cust-1");
  });

  it("classifies repository files", () => {
    const info = classifyAssetKey("uploads/customers/cust-1/repository/files/notes.pdf");
    expect(info.resource).toBe("repository");
    expect(info.customerId).toBe("cust-1");
  });

  it("classifies job photos stored inside the customer repository", () => {
    const info = classifyAssetKey(
      "uploads/customers/cust-1/repository/files/jobs/2026/09/28-09-26_Doe_techMike.jpg"
    );
    expect(info.resource).toBe("job-photo");
    expect(info.customerId).toBe("cust-1");
  });

  it("classifies the legacy job photo path and reads the job id", () => {
    const info = classifyAssetKey("uploads/jobs/job-7/2026/09/photo.jpg");
    expect(info.resource).toBe("job-photo");
    expect(info.jobId).toBe("job-7");
  });

  it("classifies the repository and documents root prefixes as owned", () => {
    // El explorador lista por prefijo: la raiz tiene que seguir siendo privada.
    expect(classifyAssetKey("uploads/customers/cust-1/repository/")).toMatchObject({
      resource: "repository",
      customerId: "cust-1",
    });
    expect(classifyAssetKey("uploads/customers/cust-1/documents/")).toMatchObject({
      resource: "customer-document",
      customerId: "cust-1",
    });
  });

  it("returns unknown for anything outside the known trees", () => {
    expect(classifyAssetKey("brand/logo.png").resource).toBe("unknown");
    expect(classifyAssetKey("uploads/customers/cust-1/other/x.pdf").resource).toBe("unknown");
    expect(classifyAssetKey("uploads/other/x.pdf").resource).toBe("unknown");
    expect(classifyAssetKey("uploads/customers/cust-1/").resource).toBe("unknown");
  });
});

describe("isPrivateAssetKey", () => {
  it("treats invoices, documents, repository and job photos as private", () => {
    expect(isPrivateAssetKey("invoices/2026/09/c1/INV-1.pdf")).toBe(true);
    expect(isPrivateAssetKey("uploads/customers/c1/documents/2026/09/f.pdf")).toBe(true);
    expect(isPrivateAssetKey("uploads/customers/c1/repository/files/a.pdf")).toBe(true);
    expect(isPrivateAssetKey("uploads/jobs/job-1/2026/09/p.jpg")).toBe(true);
  });

  it("keeps avatars and unclassified static files public", () => {
    expect(isPrivateAssetKey("avatars/tech/mike-1.jpg")).toBe(false);
    expect(isPrivateAssetKey("brand/logo.png")).toBe(false);
  });
});

describe("buildAssetApiPath", () => {
  it("encodes every segment", () => {
    expect(buildAssetApiPath("uploads/customers/c 1/repository/files/my file.pdf")).toBe(
      "/api/files/uploads/customers/c%201/repository/files/my%20file.pdf"
    );
  });
});

describe("getAssetFileName", () => {
  it("returns the last segment", () => {
    expect(getAssetFileName("invoices/2026/09/c1/INV-1.pdf")).toBe("INV-1.pdf");
  });
});
