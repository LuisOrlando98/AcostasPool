import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/lib/auth/email";

describe("normalizeEmail", () => {
  it("lower-cases the whole address", () => {
    expect(normalizeEmail("Ana.Perez@Example.COM")).toBe("ana.perez@example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeEmail("  ana@example.com\n")).toBe("ana@example.com");
  });

  it("trims and lower-cases together", () => {
    expect(normalizeEmail(" ANA@EXAMPLE.COM ")).toBe("ana@example.com");
  });

  it("returns an empty string for empty or whitespace-only input", () => {
    expect(normalizeEmail("")).toBe("");
    expect(normalizeEmail("   ")).toBe("");
  });

  it("keeps inner whitespace untouched", () => {
    expect(normalizeEmail("ana perez@example.com")).toBe("ana perez@example.com");
  });

  it("does not validate the address shape", () => {
    expect(normalizeEmail("NOT-AN-EMAIL")).toBe("not-an-email");
  });

  it("lower-cases non-ascii letters too", () => {
    expect(normalizeEmail("JOSÉ@EXAMPLE.COM")).toBe("josé@example.com");
  });
});
