import { describe, expect, it } from "vitest";
import {
  buildCustomerRepositoryRoot,
  removePrefix,
  sanitizeRepositoryName,
  sanitizeRepositoryPath,
  splitRepositoryParent,
} from "@/lib/customers/repository";

describe("buildCustomerRepositoryRoot", () => {
  it("builds the uploads root for a plain id", () => {
    expect(buildCustomerRepositoryRoot("abc-123")).toBe(
      "uploads/customers/abc-123/repository/"
    );
  });

  it("replaces unsafe characters but keeps spaces, dots, dashes and underscores", () => {
    expect(buildCustomerRepositoryRoot("a/b c.d-e_f?")).toBe(
      "uploads/customers/a_b c.d-e_f_/repository/"
    );
  });

  it("falls back to 'customer' for an empty or blank id", () => {
    expect(buildCustomerRepositoryRoot("")).toBe(
      "uploads/customers/customer/repository/"
    );
    expect(buildCustomerRepositoryRoot("   ")).toBe(
      "uploads/customers/customer/repository/"
    );
  });

  it("replaces every non-ascii character with an underscore", () => {
    expect(buildCustomerRepositoryRoot("ñá")).toBe(
      "uploads/customers/__/repository/"
    );
  });
});

describe("sanitizeRepositoryPath", () => {
  it("returns an empty string for null, undefined and empty input", () => {
    expect(sanitizeRepositoryPath(null)).toBe("");
    expect(sanitizeRepositoryPath(undefined)).toBe("");
    expect(sanitizeRepositoryPath("")).toBe("");
  });

  it("keeps a clean nested path", () => {
    expect(sanitizeRepositoryPath("folder/sub")).toBe("folder/sub");
  });

  it("strips leading and trailing slashes and whitespace", () => {
    expect(sanitizeRepositoryPath("  /folder/sub/  ")).toBe("folder/sub");
    expect(sanitizeRepositoryPath("///a///")).toBe("a");
  });

  it("converts backslashes to forward slashes", () => {
    expect(sanitizeRepositoryPath("\\folder\\sub")).toBe("folder/sub");
  });

  it.each([".", "/", "///", "   "])("returns empty for root-like %p", (raw) => {
    expect(sanitizeRepositoryPath(raw)).toBe("");
  });

  it("rejects any path with a '..' segment (path traversal guard)", () => {
    expect(sanitizeRepositoryPath("../x")).toBe("");
    expect(sanitizeRepositoryPath("a/../b")).toBe("");
    expect(sanitizeRepositoryPath("a/..")).toBe("");
    expect(sanitizeRepositoryPath("a\\..\\b")).toBe("");
  });

  it("keeps a file name that merely contains '..' inside a segment", () => {
    expect(sanitizeRepositoryPath("docs/report..pdf")).toBe("docs/report..pdf");
    expect(sanitizeRepositoryPath("a/.../b")).toBe("a/.../b");
  });

  it("replaces empty inner segments with 'item'", () => {
    expect(sanitizeRepositoryPath("a//b")).toBe("a/item/b");
  });

  it("sanitizes each segment independently", () => {
    expect(sanitizeRepositoryPath("a/b?c/d*e")).toBe("a/b_c/d_e");
    expect(sanitizeRepositoryPath("My Docs/Año 2024")).toBe("My Docs/A_o 2024");
  });

  it("rejects '.' segments like '..' (a literal '.' folder would diverge between local and S3)", () => {
    expect(sanitizeRepositoryPath("./x")).toBe("");
    expect(sanitizeRepositoryPath("a/./b")).toBe("");
  });
});

describe("sanitizeRepositoryName", () => {
  it("keeps safe names untouched", () => {
    expect(sanitizeRepositoryName("My File.pdf")).toBe("My File.pdf");
  });

  it("replaces slashes and other unsafe characters", () => {
    expect(sanitizeRepositoryName("a/b\\c:d")).toBe("a_b_c_d");
  });

  it("falls back to 'item' by default and to the given fallback otherwise", () => {
    expect(sanitizeRepositoryName("")).toBe("item");
    expect(sanitizeRepositoryName("   ")).toBe("item");
    expect(sanitizeRepositoryName("", "folder")).toBe("folder");
  });
});

describe("splitRepositoryParent", () => {
  it("splits the last segment as the name", () => {
    expect(splitRepositoryParent("a/b/c")).toEqual({ parent: "a/b", name: "c" });
  });

  it("returns an empty parent for a top-level name", () => {
    expect(splitRepositoryParent("file.txt")).toEqual({
      parent: "",
      name: "file.txt",
    });
  });

  it("returns empty parts for empty or invalid paths", () => {
    expect(splitRepositoryParent("")).toEqual({ parent: "", name: "" });
    expect(splitRepositoryParent("../x")).toEqual({ parent: "", name: "" });
  });

  it("sanitizes before splitting", () => {
    expect(splitRepositoryParent("/a/b?/")).toEqual({ parent: "a", name: "b_" });
  });
});

describe("removePrefix", () => {
  it("returns the remainder when the prefix matches", () => {
    expect(removePrefix("uploads/x/y", "uploads/x/")).toBe("y");
  });

  it("returns null when the prefix does not match", () => {
    expect(removePrefix("other/x", "uploads/")).toBeNull();
  });

  it("returns an empty string when the value equals the prefix", () => {
    expect(removePrefix("abc", "abc")).toBe("");
  });

  it("returns the whole value for an empty prefix", () => {
    expect(removePrefix("abc", "")).toBe("abc");
  });
});
