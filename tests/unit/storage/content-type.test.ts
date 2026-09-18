import { describe, expect, it } from "vitest";
import {
  buildContentDisposition,
  getContentTypeForFileName,
  resolveContentPolicy,
  sanitizeDownloadFileName,
} from "@/lib/storage/content-type";

describe("resolveContentPolicy", () => {
  it.each([
    ["INV-1.pdf", "application/pdf"],
    ["photo.jpg", "image/jpeg"],
    ["photo.png", "image/png"],
    ["report.csv", "text/csv; charset=utf-8"],
  ])("serves %s inline with its own content type", (fileName, contentType) => {
    expect(resolveContentPolicy(fileName)).toEqual({ contentType, disposition: "inline" });
  });

  it.each(["page.html", "icon.svg", "feed.xml", "app.js", "setup.exe"])(
    "forces %s to download as an opaque binary",
    (fileName) => {
      expect(resolveContentPolicy(fileName)).toEqual({
        contentType: "application/octet-stream",
        disposition: "attachment",
      });
    }
  );

  it("falls back to octet-stream for unknown extensions", () => {
    expect(getContentTypeForFileName("data.unknown")).toBe("application/octet-stream");
    expect(getContentTypeForFileName("noextension")).toBe("application/octet-stream");
  });
});

describe("sanitizeDownloadFileName", () => {
  it("removes path and quote characters", () => {
    expect(sanitizeDownloadFileName('../../etc/"passwd"', "download")).toBe("_.._etc__passwd_");
  });

  it("falls back when nothing usable is left", () => {
    expect(sanitizeDownloadFileName("...", "download")).toBe("download");
  });
});

describe("buildContentDisposition", () => {
  it("emits both the ascii and the utf-8 file name", () => {
    expect(buildContentDisposition("inline", "INV-1.pdf")).toBe(
      'inline; filename="INV-1.pdf"; filename*=UTF-8\'\'INV-1.pdf'
    );
  });

  it("degrades non-ascii names in the plain parameter", () => {
    expect(buildContentDisposition("attachment", "facturación.pdf")).toBe(
      'attachment; filename="facturaci_n.pdf"; filename*=UTF-8\'\'facturaci%C3%B3n.pdf'
    );
  });
});
