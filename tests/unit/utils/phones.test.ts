import { describe, expect, it } from "vitest";
import { formatUsPhone, normalizeUsPhone } from "@/lib/phones";

const FORMATTED = "+1 (305)-555-0123";

describe("normalizeUsPhone", () => {
  it.each([
    "3055550123",
    "(305) 555-0123",
    "305.555.0123",
    "1-305-555-0123",
    "+1 305 555 0123",
    "13055550123",
    FORMATTED,
  ])("normalizes %p to the +1 (xxx)-xxx-xxxx format", (raw) => {
    expect(normalizeUsPhone(raw)).toBe(FORMATTED);
  });

  it("strips letters and keeps the digits", () => {
    expect(normalizeUsPhone("305-555-0123 ext")).toBe(FORMATTED);
  });

  it("returns null for 11 digits not starting with 1", () => {
    expect(normalizeUsPhone("23055550123")).toBeNull();
  });

  it("returns null when there are fewer than 10 digits", () => {
    expect(normalizeUsPhone("305555012")).toBeNull();
  });

  it("returns null when there are more than 11 digits", () => {
    expect(normalizeUsPhone("305-555-0123 x99")).toBeNull();
    expect(normalizeUsPhone("130555501234")).toBeNull();
  });

  it("returns null for empty or non-numeric input", () => {
    expect(normalizeUsPhone("")).toBeNull();
    expect(normalizeUsPhone("abc")).toBeNull();
  });
});

describe("formatUsPhone", () => {
  it("returns null for undefined, null and empty string", () => {
    expect(formatUsPhone()).toBeNull();
    expect(formatUsPhone(null)).toBeNull();
    expect(formatUsPhone("")).toBeNull();
  });

  it("returns the normalized phone when valid", () => {
    expect(formatUsPhone("3055550123")).toBe(FORMATTED);
  });

  it("returns the original input when it cannot be normalized", () => {
    expect(formatUsPhone("12345")).toBe("12345");
    expect(formatUsPhone("  n/a ")).toBe("  n/a ");
  });
});
