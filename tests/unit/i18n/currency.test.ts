import { describe, expect, it, vi } from "vitest";
import { formatCurrency } from "@/lib/format/currency";

describe("formatCurrency", () => {
  it("formats USD with US conventions for both app locales", () => {
    expect(formatCurrency(1234.5, "en")).toBe("$1,234.50");
    expect(formatCurrency(1234.5, "es")).toBe("$1,234.50");
  });

  it("always shows two decimals, including zero and negative amounts", () => {
    expect(formatCurrency(0, "en")).toBe("$0.00");
    expect(formatCurrency(-12, "en")).toBe("-$12.00");
    expect(formatCurrency(9.999, "en")).toBe("$10.00");
  });

  it("accepts full BCP 47 tags and other currencies", () => {
    expect(formatCurrency(1234.5, "de-DE", "EUR")).toMatch(/^1\.234,50\s€$/);
    expect(formatCurrency(1234.5, "en-GB", "GBP")).toBe("£1,234.50");
  });

  it("falls back to en-US for a malformed locale tag", () => {
    expect(formatCurrency(1, "not a locale")).toBe("$1.00");
  });

  it("still rejects an invalid currency code", () => {
    expect(() => formatCurrency(1, "en", "DOLLARS")).toThrow(RangeError);
  });

  it("reuses the formatter for the same locale and currency", () => {
    const spy = vi.spyOn(Intl, "NumberFormat");
    try {
      formatCurrency(1, "fr-CA", "CAD");
      formatCurrency(2, "fr-CA", "CAD");
      formatCurrency(3, "fr-CA", "CAD");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
