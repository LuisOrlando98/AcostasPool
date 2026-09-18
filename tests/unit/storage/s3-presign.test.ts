import { createHash, createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { presignS3GetUrl } from "@/lib/storage/s3-presign";

const BASE_INPUT = {
  bucket: "acostas-assets",
  region: "us-east-1",
  key: "invoices/2026/09/cust-1/INV-1.pdf",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  expiresInSeconds: 120,
  now: new Date("2026-09-18T10:00:00.000Z"),
};

/**
 * Recalcula la firma a partir de la URL devuelta, siguiendo la especificación
 * SigV4 de forma independiente. Detecta el fallo típico del prefirmado: que lo
 * firmado no coincida con lo que se envía.
 */
function recomputeSignature(url: string) {
  const parsed = new URL(url);
  const signature = parsed.searchParams.get("X-Amz-Signature") ?? "";
  const amzDate = parsed.searchParams.get("X-Amz-Date") ?? "";
  const dateStamp = amzDate.slice(0, 8);
  const region = (parsed.searchParams.get("X-Amz-Credential") ?? "").split("/")[2] ?? "";

  const canonicalQuery = [...parsed.searchParams.entries()]
    .filter(([name]) => name !== "X-Amz-Signature")
    .map(([name, value]) => [encodeURIComponent(name), encodeURIComponent(value)] as const)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    parsed.pathname,
    canonicalQuery,
    `host:${parsed.host}`,
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
  ].join("\n");

  const hmac = (key: Buffer | string, data: string) =>
    createHmac("sha256", key).update(data, "utf8").digest();
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${BASE_INPUT.secretAccessKey}`, dateStamp), region), "s3"),
    "aws4_request"
  );

  return { signature, expected: hmac(signingKey, stringToSign).toString("hex") };
}

describe("presignS3GetUrl", () => {
  it("builds a virtual-hosted url for the requested key", () => {
    const url = new URL(presignS3GetUrl(BASE_INPUT));

    expect(url.host).toBe("acostas-assets.s3.us-east-1.amazonaws.com");
    expect(url.pathname).toBe("/invoices/2026/09/cust-1/INV-1.pdf");
  });

  it("includes every SigV4 query parameter", () => {
    const url = new URL(presignS3GetUrl(BASE_INPUT));

    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toBe(
      "AKIAIOSFODNN7EXAMPLE/20260918/us-east-1/s3/aws4_request"
    );
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260918T100000Z");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signs exactly the request it sends", () => {
    const { signature, expected } = recomputeSignature(presignS3GetUrl(BASE_INPUT));

    expect(signature).toBe(expected);
  });

  it("signs the response overrides it adds to the url", () => {
    const url = presignS3GetUrl({
      ...BASE_INPUT,
      responseContentType: "application/pdf",
      responseContentDisposition: 'inline; filename="INV-1.pdf"',
    });
    const { signature, expected } = recomputeSignature(url);

    expect(new URL(url).searchParams.get("response-content-disposition")).toBe(
      'inline; filename="INV-1.pdf"'
    );
    expect(signature).toBe(expected);
  });

  it("includes and signs a session token when present", () => {
    const url = presignS3GetUrl({ ...BASE_INPUT, sessionToken: "session-token-value" });
    const { signature, expected } = recomputeSignature(url);

    expect(new URL(url).searchParams.get("X-Amz-Security-Token")).toBe("session-token-value");
    expect(signature).toBe(expected);
  });

  it("escapes spaces in the key as %20 instead of +", () => {
    const url = presignS3GetUrl({
      ...BASE_INPUT,
      key: "uploads/customers/cust-1/repository/files/my file.pdf",
    });

    expect(url).toContain("/uploads/customers/cust-1/repository/files/my%20file.pdf?");
  });

  it("is deterministic for the same instant and changes with it", () => {
    const first = presignS3GetUrl(BASE_INPUT);
    const same = presignS3GetUrl(BASE_INPUT);
    const later = presignS3GetUrl({ ...BASE_INPUT, now: new Date("2026-09-18T11:00:00.000Z") });

    expect(same).toBe(first);
    expect(later).not.toBe(first);
  });
});
