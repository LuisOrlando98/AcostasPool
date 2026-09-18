import { afterEach, describe, expect, it, vi } from "vitest";
import { getAssetUrl } from "@/lib/assets";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAssetUrl - private resources", () => {
  it("routes a historical relative invoice path through the authenticated API", () => {
    expect(getAssetUrl("/invoices/2026/09/cust-1/INV-1.pdf")).toBe(
      "/api/files/invoices/2026/09/cust-1/INV-1.pdf"
    );
  });

  it("routes an absolute S3 url through the authenticated API", () => {
    expect(
      getAssetUrl("https://bucket.s3.us-east-1.amazonaws.com/invoices/2026/09/cust-1/INV-1.pdf")
    ).toBe("/api/files/invoices/2026/09/cust-1/INV-1.pdf");
  });

  it("routes an absolute CDN url through the authenticated API", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_URL", "https://cdn.example.com");

    expect(getAssetUrl("https://cdn.example.com/uploads/customers/c1/documents/2026/09/f.pdf")).toBe(
      "/api/files/uploads/customers/c1/documents/2026/09/f.pdf"
    );
  });

  it("routes job photos stored in the customer repository", () => {
    expect(
      getAssetUrl("/uploads/customers/c1/repository/files/jobs/2026/09/28-09-26_Doe_techMike.jpg")
    ).toBe("/api/files/uploads/customers/c1/repository/files/jobs/2026/09/28-09-26_Doe_techMike.jpg");
  });

  it("encodes spaces in repository file names", () => {
    expect(getAssetUrl("/uploads/customers/c1/repository/files/pool report.pdf")).toBe(
      "/api/files/uploads/customers/c1/repository/files/pool%20report.pdf"
    );
  });

  it("ignores the CDN base for private resources", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_URL", "https://cdn.example.com");

    expect(getAssetUrl("/invoices/2026/09/c1/INV-1.pdf")).toBe(
      "/api/files/invoices/2026/09/c1/INV-1.pdf"
    );
  });
});

describe("getAssetUrl - public resources", () => {
  it("keeps avatars on the public CDN", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_URL", "https://cdn.example.com");

    expect(getAssetUrl("/avatars/tech/mike-1.jpg")).toBe(
      "https://cdn.example.com/avatars/tech/mike-1.jpg"
    );
  });

  it("returns the avatar path unchanged when no CDN is configured", () => {
    expect(getAssetUrl("/avatars/tech/mike-1.jpg")).toBe("/avatars/tech/mike-1.jpg");
  });

  it("returns an absolute avatar url unchanged", () => {
    expect(getAssetUrl("https://cdn.example.com/avatars/admin/jane-1.png")).toBe(
      "https://cdn.example.com/avatars/admin/jane-1.png"
    );
  });

  it("leaves unclassified static assets alone", () => {
    expect(getAssetUrl("/brand/logo.png")).toBe("/brand/logo.png");
  });

  it("returns an empty string for missing values", () => {
    expect(getAssetUrl(null)).toBe("");
    expect(getAssetUrl(undefined)).toBe("");
    expect(getAssetUrl("")).toBe("");
  });
});
