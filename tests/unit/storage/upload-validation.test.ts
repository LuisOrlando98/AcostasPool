import { describe, expect, it } from "vitest";
import {
  UPLOAD_SIGNATURE_SAMPLE_BYTES,
  validateUploadFile,
} from "@/lib/storage/upload-validation";

const PDF_BYTES = Buffer.from("%PDF-1.7\n%bytes");
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF_BYTES = Buffer.from("GIF89a-------");
const WEBP_BYTES = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
]);
const HEIC_BYTES = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from("ftypheic"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
]);
const ZIP_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const OLE_BYTES = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
const TEXT_BYTES = Buffer.from("name,email\nJane,jane@example.com\n");

describe("validateUploadFile - allowed types", () => {
  it("accepts a pdf and returns its canonical content type", () => {
    const result = validateUploadFile({
      fileName: "contract.pdf",
      declaredType: "application/pdf",
      bytes: PDF_BYTES,
    });

    expect(result).toEqual({ ok: true, extension: "pdf", contentType: "application/pdf" });
  });

  it.each([
    ["photo.png", PNG_BYTES, "image/png"],
    ["photo.jpg", JPEG_BYTES, "image/jpeg"],
    ["photo.jpeg", JPEG_BYTES, "image/jpeg"],
    ["photo.gif", GIF_BYTES, "image/gif"],
    ["photo.webp", WEBP_BYTES, "image/webp"],
    ["photo.heic", HEIC_BYTES, "image/heic"],
    ["archive.zip", ZIP_BYTES, "application/zip"],
    ["sheet.xlsx", ZIP_BYTES, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["doc.docx", ZIP_BYTES, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["legacy.doc", OLE_BYTES, "application/msword"],
    ["legacy.xls", OLE_BYTES, "application/vnd.ms-excel"],
    ["contacts.csv", TEXT_BYTES, "text/csv"],
    ["notes.txt", TEXT_BYTES, "text/plain"],
  ])("accepts %s", (fileName, bytes, contentType) => {
    const result = validateUploadFile({ fileName, declaredType: null, bytes });

    expect(result).toEqual({ ok: true, extension: expect.any(String), contentType });
  });
});

describe("validateUploadFile - rejected types", () => {
  it.each(["page.html", "icon.svg", "data.xml", "script.js", "installer.exe", "run.sh"])(
    "rejects %s with 415",
    (fileName) => {
      const result = validateUploadFile({ fileName, declaredType: null, bytes: TEXT_BYTES });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.status).toBe(415);
      expect(result.ok === false && result.error).toContain("unsupported type");
    }
  );

  it("rejects a file without extension", () => {
    const result = validateUploadFile({ fileName: "payload", declaredType: null, bytes: PDF_BYTES });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("without extension");
  });

  it("rejects a blocked content type even with an allowed extension", () => {
    const result = validateUploadFile({
      fileName: "invoice.pdf",
      declaredType: "image/svg+xml",
      bytes: PDF_BYTES,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(415);
  });
});

describe("validateUploadFile - magic bytes", () => {
  it("rejects an svg renamed to .png", () => {
    const result = validateUploadFile({
      fileName: "logo.png",
      declaredType: "image/png",
      bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("does not match its extension");
  });

  it("rejects html renamed to .pdf", () => {
    const result = validateUploadFile({
      fileName: "invoice.pdf",
      declaredType: "application/pdf",
      bytes: Buffer.from("<!doctype html><script>alert(1)</script>"),
    });

    expect(result.ok).toBe(false);
  });

  it("rejects markup inside a .csv", () => {
    const result = validateUploadFile({
      fileName: "report.csv",
      declaredType: "text/csv",
      bytes: Buffer.from("  <html><body>hi</body></html>"),
    });

    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    const result = validateUploadFile({
      fileName: "empty.pdf",
      declaredType: "application/pdf",
      bytes: Buffer.alloc(0),
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(400);
  });

  it("only needs the first bytes of the file", () => {
    const head = Buffer.concat([PDF_BYTES, Buffer.alloc(16)]).subarray(
      0,
      UPLOAD_SIGNATURE_SAMPLE_BYTES
    );

    const result = validateUploadFile({ fileName: "big.pdf", declaredType: null, bytes: head });

    expect(result.ok).toBe(true);
  });
});
